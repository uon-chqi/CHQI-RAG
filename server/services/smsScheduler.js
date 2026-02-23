/**
 * SMS Scheduler Service
 * 
 * Handles automated one-way SMS messaging based on appointment dates and patient risk levels.
 * This service should be run as a periodic job (e.g., every hour or daily).
 * 
 * Flow:
 * 1. Find appointments within the next 30 days
 * 2. For each appointment, get patient risk level and SMS configuration
 * 3. Determine which messages should be sent based on days before appointment
 * 4. Check if message already sent and budget not exceeded
 * 5. Send message and log it
 */

import { query } from '../config/database.js';
import { sms } from './sms.js';

// Helper to calculate days between two dates
const daysBetween = (date1, date2) => {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.floor((date1 - date2) / oneDay);
};

// Helper to check if message should be sent
const shouldSendMessage = (appointmentDate, messageDaysBefore) => {
  const now = new Date();
  const appointmentTime = new Date(appointmentDate);
  const daysUntilAppointment = daysBetween(appointmentTime, now);
  
  // Send if we're within the day window (between messageDaysBefore and messageDaysBefore-1)
  return daysUntilAppointment >= messageDaysBefore && daysUntilAppointment < messageDaysBefore + 1;
};

// Helper to format template with variables
const formatTemplate = (template, variables) => {
  let message = template;
  Object.entries(variables).forEach(([key, value]) => {
    const placeholder = `{{${key}}}`;
    message = message.replace(new RegExp(placeholder, 'g'), value);
  });
  return message;
};

export const smsScheduler = {
  /**
   * Process and send automated appointment reminder messages
   * Call this function periodically (hourly or every 30 minutes)
   */
  async processAppointmentReminders() {
    try {
      console.log('[SMS Scheduler] Starting appointment reminder processing...');
      
      // Get all appointments in the next 30 days
      const appointmentsResult = await query(
        `SELECT a.*, p.phone_number, p.risk_level, p.facility_id, p.patient_name, p.id as patient_id
         FROM appointments a
         JOIN patients p ON a.patient_id = p.id
         WHERE a.status = 'scheduled'
         AND a.appointment_date > now()
         AND a.appointment_date < now() + interval '30 days'
         AND p.status = 'active'
         ORDER BY a.appointment_date ASC`
      );

      console.log(`Found ${appointmentsResult.rows.length} upcoming appointments`);

      let totalSent = 0;
      let totalFailed = 0;

      for (const appointment of appointmentsResult.rows) {
        try {
          const sent = await this.processAppointment(appointment);
          totalSent += sent;
        } catch (error) {
          console.error(`Error processing appointment ${appointment.id}:`, error);
          totalFailed++;
        }
      }

      console.log(`[SMS Scheduler] Complete. Sent: ${totalSent}, Failed: ${totalFailed}`);
      return { totalSent, totalFailed };
    } catch (error) {
      console.error('[SMS Scheduler] Error in processAppointmentReminders:', error);
      throw error;
    }
  },

  /**
   * Process a single appointment and send scheduled messages
   */
  async processAppointment(appointment) {
    const {
      id: appointmentId,
      patient_id,
      phone_number,
      risk_level,
      facility_id,
      patient_name,
      appointment_date,
      appointment_type
    } = appointment;

    let messagesSent = 0;

    try {
      // Get SMS configuration for this risk level
      const configResult = await query(
        `SELECT * FROM sms_configurations 
         WHERE facility_id = $1 AND risk_level = $2 AND enabled = true`,
        [facility_id, risk_level]
      );

      if (configResult.rows.length === 0) {
        console.log(`No SMS configuration for facility ${facility_id}, risk level ${risk_level}`);
        return 0;
      }

      const config = configResult.rows[0];
      const messageTiming = config.message_timing;

      if (!Array.isArray(messageTiming)) {
        console.error(`Invalid message_timing for config ${config.id}`);
        return 0;
      }

      // Check each scheduled message timing
      for (const timing of messageTiming) {
        if (!timing.enabled) continue;

        const { days_before_appointment, time } = timing;

        // Check if message should be sent
        if (!shouldSendMessage(appointmentDate, days_before_appointment)) {
          continue;
        }

        // Check if message already sent
        const existingResult = await query(
          `SELECT id FROM sms_sent_messages 
           WHERE appointment_id = $1 
           AND message_type = 'automated_reminder'
           AND status = 'sent'`,
          [appointmentId]
        );

        if (existingResult.rows.length > 0) {
          console.log(`Message already sent for appointment ${appointmentId}`);
          continue;
        }

        // Check budget
        const budgetCheck = await this.checkBudget(facility_id, risk_level, patient_id);
        if (!budgetCheck.allowed) {
          console.log(`Budget limit reached for facility ${facility_id}, risk level ${risk_level}`);
          continue;
        }

        // Get message template
        const templateResult = await query(
          `SELECT * FROM message_templates 
           WHERE facility_id = $1 
           AND template_type = 'appointment_reminder'
           AND (risk_level = $2 OR risk_level IS NULL)
           AND enabled = true
           ORDER BY risk_level DESC
           LIMIT 1`,
          [facility_id, risk_level]
        );

        if (templateResult.rows.length === 0) {
          console.warn(`No message template for appointment reminder at facility ${facility_id}`);
          continue;
        }

        const template = templateResult.rows[0];

        // Format message with appointment details
        const formattedMessage = formatTemplate(template.body, {
          patient_name: patient_name || 'Patient',
          appointment_date: new Date(appointmentDate).toLocaleDateString(),
          appointment_time: new Date(appointmentDate).toLocaleTimeString(),
          clinic_name: 'Your Clinic',
          days_until: days_before_appointment
        });

        // Send message
        try {
          const sendResult = await sms.sendMessage(phone_number, formattedMessage);

          // Log sent message
          await query(
            `INSERT INTO sms_sent_messages 
             (patient_id, facility_id, appointment_id, message_type, phone_number, message_body, 
              channel, status, external_message_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [patient_id, facility_id, appointmentId, 'automated_reminder', phone_number, 
             formattedMessage, 'sms', 'sent', sendResult.messageId || null]
          );

          messagesSent++;
          console.log(`✅ Sent appointment reminder for appointment ${appointmentId}`);
        } catch (sendError) {
          console.error(`Failed to send message for appointment ${appointmentId}:`, sendError);

          // Log failed message
          await query(
            `INSERT INTO sms_sent_messages 
             (patient_id, facility_id, appointment_id, message_type, phone_number, message_body, 
              channel, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [patient_id, facility_id, appointmentId, 'automated_reminder', phone_number, 
             formattedMessage, 'sms', 'failed']
          );
        }
      }
    } catch (error) {
      console.error(`Error processing appointment ${appointmentId}:`, error);
    }

    return messagesSent;
  },

  /**
   * Check if facility/risk level has remaining SMS budget for the month
   */
  async checkBudget(facilityId, riskLevel, patientId) {
    try {
      // Get budget limit
      const budgetResult = await query(
        `SELECT * FROM sms_budget_limits 
         WHERE facility_id = $1 AND risk_level = $2 AND enabled = true`,
        [facilityId, riskLevel]
      );

      if (budgetResult.rows.length === 0) {
        // No budget configured, allow unlimited
        return { allowed: true };
      }

      const budget = budgetResult.rows[0];
      const { messages_per_month, messages_per_patient_per_month, budget_month_start_day } = budget;

      // Calculate current month start
      const today = new Date();
      let monthStart = new Date(today.getFullYear(), today.getMonth(), budget_month_start_day);
      if (monthStart > today) {
        monthStart = new Date(today.getFullYear(), today.getMonth() - 1, budget_month_start_day);
      }

      // Check facility-level budget
      const sentResult = await query(
        `SELECT COUNT(*) as count FROM sms_sent_messages 
         WHERE facility_id = $1 
         AND created_at >= $2 
         AND status IN ('sent', 'pending')`,
        [facilityId, monthStart]
      );

      const sentCount = parseInt(sentResult.rows[0].count);
      if (sentCount >= messages_per_month) {
        return { allowed: false, reason: 'Facility budget exceeded' };
      }

      // Check patient-level budget if configured
      if (messages_per_patient_per_month) {
        const patientSentResult = await query(
          `SELECT COUNT(*) as count FROM sms_sent_messages 
           WHERE patient_id = $1 
           AND created_at >= $2 
           AND status IN ('sent', 'pending')`,
          [patientId, monthStart]
        );

        const patientSentCount = parseInt(patientSentResult.rows[0].count);
        if (patientSentCount >= messages_per_patient_per_month) {
          return { allowed: false, reason: 'Patient budget exceeded' };
        }
      }

      return { allowed: true };
    } catch (error) {
      console.error('Error checking budget:', error);
      return { allowed: false, reason: 'Error checking budget' };
    }
  },

  /**
   * Process missed appointment callback messages
   * This would be integrated with the flowchart responses
   */
  async processMissedAppointmentCallback(patientId, appointmentId, response) {
    try {
      // Get appointment and patient details
      const result = await query(
        `SELECT a.*, p.phone_number, p.facility_id, p.patient_name
         FROM appointments a
         JOIN patients p ON a.patient_id = p.id
         WHERE a.id = $1 AND p.id = $2`,
        [appointmentId, patientId]
      );

      if (result.rows.length === 0) {
        throw new Error('Appointment or patient not found');
      }

      const { phone_number, facility_id, patient_name } = result.rows[0];

      // Get appropriate response message template
      const templateResult = await query(
        `SELECT * FROM message_templates 
         WHERE facility_id = $1 
         AND template_type = 'missed_appointment_response'
         AND enabled = true
         LIMIT 1`,
        [facility_id]
      );

      if (templateResult.rows.length === 0) {
        console.warn(`No response template for missed appointment at facility ${facility_id}`);
        return;
      }

      const template = templateResult.rows[0];
      const formattedMessage = formatTemplate(template.body, {
        patient_name: patient_name || 'Patient',
        response_reason: response
      });

      // Send response message
      try {
        const sendResult = await sms.sendMessage(phone_number, formattedMessage);

        await query(
          `INSERT INTO sms_sent_messages 
           (patient_id, facility_id, appointment_id, message_type, phone_number, message_body, 
            channel, status, external_message_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [patientId, facility_id, appointmentId, 'missed_appointment_response', phone_number, 
           formattedMessage, 'sms', 'sent', sendResult.messageId || null]
        );

        console.log(`✅ Sent missed appointment response for patient ${patientId}`);
      } catch (sendError) {
        console.error('Failed to send response:', sendError);
      }
    } catch (error) {
      console.error('Error processing missed appointment callback:', error);
    }
  }
};

export default smsScheduler;
