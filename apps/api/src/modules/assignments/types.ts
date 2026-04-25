import type {
  Assignment as AssignmentContract,
  CreateAssignmentPayload,
  UpdateAssignmentPayload,
} from '@surmoda/contracts';

export type AssignmentDTO = AssignmentContract;
export type CreateAssignmentDTO = CreateAssignmentPayload;
export type UpdateAssignmentDTO = UpdateAssignmentPayload;

// BE-only: no contracts equivalent (UI-state / query param concern).
export interface RemoveAssignmentOptions {
  confirm?: boolean;
}
