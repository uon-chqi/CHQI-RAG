// ================================================================
// SMS MODULE — TypeScript interfaces mirroring the NestJS DTOs
// ================================================================

// --- ENUMS ---

export enum WorkflowTriggerEvent {
  DAYS_BEFORE_APPOINTMENT = 'DAYS_BEFORE_APPOINTMENT',
  MISSED_APPOINTMENT = 'MISSED_APPOINTMENT',
  POST_DISCHARGE = 'POST_DISCHARGE',
  MANUAL_TRIGGER = 'MANUAL_TRIGGER',
}

export enum StepActionType {
  SEND_SMS = 'SEND_SMS',
  WAIT_FOR_REPLY = 'WAIT_FOR_REPLY',
  SYSTEM_ACTION = 'SYSTEM_ACTION',
}

// --- TEMPLATES ---

export interface SmsTemplateVariable {
  tag: string;
  key: string;
  description: string;
  example: string;
}

export interface SmsTemplate {
  id: string;
  facilityId: string | null;
  name: string;
  body: string;
  isActive?: boolean;
  createdAt: string;
  updatedAt: string;
}

// Backend DTO compatibility for /sms-templates responses.
export interface SmsTemplateApi {
  id: string;
  name: string;
  body: string;
  facilityId?: string | null;
  facility_id?: string | null;
  isActive?: boolean;
  is_active?: boolean;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
}

// --- WORKFLOWS ---

export interface WorkflowStep {
  id?: string;
  isFirstStep: boolean;
  actionType: StepActionType;
  config: Record<string, unknown>;
  nextStepId?: string | null;
}

export interface Workflow {
  id: string;
  facilityId: string | null;
  name: string;
  triggerEvent: WorkflowTriggerEvent;
  triggerCondition?: Record<string, unknown>;
  isActive: boolean;
  steps: WorkflowStep[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowTriggerRequest {
  cccNumber: string;
}

export interface WorkflowTriggerResponse {
  success: boolean;
  message: string;
}

// --- API RESPONSE WRAPPERS ---

export interface SmsApiResponse<T> {
  data: T;
  message?: string;
}

export interface SmsApiListResponse<T> {
  data: T[];
  total?: number;
}
