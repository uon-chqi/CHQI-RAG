import express from 'express';
import { pool } from '../config/database.js';

const router = express.Router();

const emptyToNull = (value) => {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text === '' ? null : text;
};

const parseHl7Date = (value) => {
  const text = emptyToNull(value);
  if (!text) return null;
  if (/^\d{8}$/.test(text)) {
    return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
  }
  return text;
};

const parseHl7DateTime = (value) => {
  const text = emptyToNull(value);
  if (!text) return null;
  if (/^\d{14}$/.test(text)) {
    return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}T${text.slice(8, 10)}:${text.slice(10, 12)}:${text.slice(12, 14)}`;
  }
  if (/^\d{8}$/.test(text)) return parseHl7Date(text);
  return text;
};

const getIdentifier = (patientIdentification, identifierType) => {
  const ids = patientIdentification?.internal_patient_id || [];
  return ids.find((item) => item.identifier_type === identifierType)?.id || null;
};

const mapAppointmentStatus = (appointment, actionCode) => {
  if (actionCode === 'C' || actionCode === 'D') return 'cancelled';

  const status = emptyToNull(appointment?.appointment_status)?.toUpperCase();
  if (status === 'COMPLETED') return 'completed';
  if (status === 'CANCELLED' || status === 'CANCELED') return 'cancelled';
  if (status === 'MISSED' || status === 'NO_SHOW') return 'missed';
  return 'scheduled';
};

const getDefaultCountyId = async (client) => {
  const existing = await client.query(
    `SELECT id
     FROM counties
     WHERE name = 'Unknown'
     ORDER BY created_at ASC
     LIMIT 1`
  );
  if (existing.rows[0]) return existing.rows[0].id;

  const firstCounty = await client.query(
    `SELECT id
     FROM counties
     ORDER BY created_at ASC
     LIMIT 1`
  );
  if (firstCounty.rows[0]) return firstCounty.rows[0].id;

  const created = await client.query(
    `INSERT INTO counties (name, code, is_active)
     VALUES ('Unknown', 'UNKNOWN', true)
     RETURNING id`
  );
  return created.rows[0].id;
};

const findOrCreateFacility = async (client, facilityCode) => {
  const code = emptyToNull(facilityCode);
  if (!code) return null;

  const existing = await client.query(
    'SELECT id FROM facilities WHERE code = $1 LIMIT 1',
    [code]
  );
  if (existing.rows[0]) return existing.rows[0].id;

  const countyId = await getDefaultCountyId(client);

  const created = await client.query(
    `INSERT INTO facilities (name, code, county_id, facility_type, operational_status, is_active)
     VALUES ($1, $2, $3, 'clinic', 'active', true)
     RETURNING id`,
    [`Facility ${code}`, code, countyId]
  );
  return created.rows[0].id;
};

const upsertPatient = async (client, payload, facilityId) => {
  const patient = payload.patient_identification || {};
  const name = patient.patient_name || {};
  const motherName = patient.mother_name || {};
  const address = patient.patient_address || {};
  const physical = address.physical_address || {};

  const cccNumber = emptyToNull(getIdentifier(patient, 'CCC_NUMBER'));
  const patientClinicNumber = emptyToNull(getIdentifier(patient, 'PATIENT_CLINIC_NUMBER'));
  const godsNumber = emptyToNull(patient.external_patient_id?.id);

  const existing = await client.query(
    `SELECT id FROM patients
     WHERE ($1::text IS NOT NULL AND ccc_number = $1)
        OR ($2::text IS NOT NULL AND patient_clinic_number = $2)
        OR ($3::text IS NOT NULL AND gods_number = $3)
     ORDER BY updated_at DESC
     LIMIT 1`,
    [cccNumber, patientClinicNumber, godsNumber]
  );

  const values = [
    facilityId,
    cccNumber,
    godsNumber,
    patientClinicNumber,
    emptyToNull(name.first_name),
    emptyToNull(name.middle_name),
    emptyToNull(name.last_name),
    emptyToNull(motherName.first_name),
    emptyToNull(motherName.middle_name),
    emptyToNull(motherName.last_name),
    parseHl7Date(patient.date_of_birth),
    emptyToNull(patient.sex),
    emptyToNull(patient.sex),
    emptyToNull(patient.phone_number),
    emptyToNull(physical.village),
    emptyToNull(physical.ward),
    emptyToNull(physical.sub_county),
    emptyToNull(physical.county),
    emptyToNull(physical.gps_location),
    emptyToNull(physical.nearest_landmark),
    emptyToNull(address.postal_address),
    emptyToNull(patient.marital_status),
    parseHl7Date(patient.death_date),
    emptyToNull(patient.death_indicator),
    emptyToNull(patient.date_of_birth_precision)
  ];

  if (existing.rows[0]) {
    const updated = await client.query(
      `UPDATE patients
       SET facility_id = COALESCE($1, facility_id),
           ccc_number = COALESCE($2, ccc_number),
           gods_number = COALESCE($3, gods_number),
           patient_clinic_number = COALESCE($4, patient_clinic_number),
           first_name = COALESCE($5, first_name),
           middle_name = COALESCE($6, middle_name),
           last_name = COALESCE($7, last_name),
           mother_first_name = COALESCE($8, mother_first_name),
           mother_middle_name = COALESCE($9, mother_middle_name),
           mother_last_name = COALESCE($10, mother_last_name),
           date_of_birth = COALESCE($11::date, date_of_birth),
           sex = COALESCE($12, sex),
           gender = COALESCE($13, gender),
           phone = COALESCE($14, phone),
           village = COALESCE($15, village),
           ward = COALESCE($16, ward),
           sub_county = COALESCE($17, sub_county),
           county_name = COALESCE($18, county_name),
           gps_location = COALESCE($19, gps_location),
           nearest_landmark = COALESCE($20, nearest_landmark),
           postal_address = COALESCE($21, postal_address),
           marital_status = COALESCE($22, marital_status),
           death_date = COALESCE($23::date, death_date),
           death_indicator = COALESCE($24, death_indicator),
           date_of_birth_precision = COALESCE($25, date_of_birth_precision),
           updated_at = NOW()
       WHERE id = $26
       RETURNING id`,
      [...values, existing.rows[0].id]
    );
    return updated.rows[0].id;
  }

  const inserted = await client.query(
    `INSERT INTO patients (
       facility_id, ccc_number, gods_number, patient_clinic_number,
       first_name, middle_name, last_name,
       mother_first_name, mother_middle_name, mother_last_name,
       date_of_birth, sex, gender, phone,
       village, ward, sub_county, county_name, gps_location, nearest_landmark, postal_address,
       marital_status, death_date, death_indicator, date_of_birth_precision
     )
     VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
       $11::date, $12, $13, $14, $15, $16, $17, $18, $19, $20,
       $21, $22, $23::date, $24, $25
     )
     RETURNING id`,
    values
  );

  return inserted.rows[0].id;
};

router.post('/siu-s12', async (req, res) => {
  const payload = req.body;
  const header = payload.message_header || {};
  const appointments = payload.appointment_information || [];

  if (!header.message_type || header.message_type !== 'SIU^S12') {
    return res.status(400).json({
      success: false,
      error: 'message_header.message_type must be SIU^S12'
    });
  }

  if (!payload.patient_identification) {
    return res.status(400).json({
      success: false,
      error: 'patient_identification is required'
    });
  }

  if (!Array.isArray(appointments) || appointments.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'appointment_information must be a non-empty array'
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const messageResult = await client.query(
      `INSERT INTO hl7_messages (
         message_type, sending_application, sending_facility, receiving_application,
         receiving_facility, message_datetime, processing_id, raw_payload
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        emptyToNull(header.message_type),
        emptyToNull(header.sending_application),
        emptyToNull(header.sending_facility),
        emptyToNull(header.receiving_application),
        emptyToNull(header.receiving_facility),
        emptyToNull(header.message_datetime),
        emptyToNull(header.processing_id),
        payload
      ]
    );

    const facilityId = await findOrCreateFacility(client, header.sending_facility);
    const patientId = await upsertPatient(client, payload, facilityId);
    const savedAppointments = [];

    for (const appointment of appointments) {
      const appointmentDate = parseHl7DateTime(appointment.appointment_date);
      if (!appointmentDate) {
        throw new Error('appointment_information[].appointment_date is required');
      }

      const actionCode = emptyToNull(appointment.action_code);
      const localStatus = mapAppointmentStatus(appointment, actionCode);
      const placer = appointment.placer_appointment_number || {};

      const result = await client.query(
        `INSERT INTO appointments (
           patient_id, facility_id,
           sending_application, sending_facility, receiving_application, receiving_facility,
           message_datetime, security, message_type, processing_id,
           action_code, appointment_reason, appointment_placing_entity,
           appointment_status, appointment_type, appointment_note,
           appointment_date, visit_date, placer_entity, placer_number,
           status, notes, metadata, raw_payload
         )
         VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
           $11, $12, $13, $14, $15, $16, $17::timestamptz, $18::date, $19, $20,
           $21, $22, $23, $24
         )
         ON CONFLICT (patient_id, appointment_date) DO UPDATE
         SET facility_id = EXCLUDED.facility_id,
             action_code = EXCLUDED.action_code,
             appointment_reason = EXCLUDED.appointment_reason,
             appointment_placing_entity = EXCLUDED.appointment_placing_entity,
             appointment_status = EXCLUDED.appointment_status,
             appointment_type = EXCLUDED.appointment_type,
             appointment_note = EXCLUDED.appointment_note,
             visit_date = EXCLUDED.visit_date,
             placer_entity = EXCLUDED.placer_entity,
             placer_number = EXCLUDED.placer_number,
             status = EXCLUDED.status,
             notes = EXCLUDED.notes,
             metadata = EXCLUDED.metadata,
             raw_payload = EXCLUDED.raw_payload,
             updated_at = NOW()
         RETURNING id, appointment_date, status`,
        [
          patientId,
          facilityId,
          emptyToNull(header.sending_application),
          emptyToNull(header.sending_facility),
          emptyToNull(header.receiving_application),
          emptyToNull(header.receiving_facility),
          emptyToNull(header.message_datetime),
          emptyToNull(header.security),
          emptyToNull(header.message_type),
          emptyToNull(header.processing_id),
          actionCode,
          emptyToNull(appointment.appointment_reason),
          emptyToNull(appointment.appointment_placing_entity),
          emptyToNull(appointment.appointment_status),
          emptyToNull(appointment.appointment_type),
          emptyToNull(appointment.appointment_note),
          appointmentDate,
          parseHl7Date(appointment.visit_date),
          emptyToNull(placer.entity),
          emptyToNull(placer.number),
          localStatus,
          emptyToNull(appointment.appointment_note),
          {
            placer_appointment_number: placer,
            source: 'KENYAEMR_HL7_SIU_S12'
          },
          payload
        ]
      );

      savedAppointments.push(result.rows[0]);
    }

    const nextAppointment = savedAppointments.find((appointment) => appointment.status === 'scheduled');
    if (nextAppointment) {
      await client.query(
        'UPDATE patients SET next_appointment_date = $1, updated_at = NOW() WHERE id = $2',
        [nextAppointment.appointment_date, patientId]
      );
    }

    await client.query(
      `UPDATE hl7_messages
       SET status = 'processed', processed_at = NOW()
       WHERE id = $1`,
      [messageResult.rows[0].id]
    );

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message_id: messageResult.rows[0].id,
      patient_id: patientId,
      facility_id: facilityId,
      appointments: savedAppointments
    });
  } catch (error) {
    await client.query('ROLLBACK');

    try {
      await pool.query(
        `INSERT INTO hl7_messages (
           message_type, sending_application, sending_facility, receiving_application,
           receiving_facility, message_datetime, processing_id, raw_payload, status, error_message
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'error', $9)`,
        [
          emptyToNull(header.message_type),
          emptyToNull(header.sending_application),
          emptyToNull(header.sending_facility),
          emptyToNull(header.receiving_application),
          emptyToNull(header.receiving_facility),
          emptyToNull(header.message_datetime),
          emptyToNull(header.processing_id),
          payload,
          error.message
        ]
      );
    } catch (logError) {
      console.error('Failed to log HL7 error message:', logError);
    }

    console.error('Error processing SIU^S12 payload:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process SIU^S12 payload',
      detail: error.message
    });
  } finally {
    client.release();
  }
});

export default router;
