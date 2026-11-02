export enum ApplicationStatus {
  PENDING = 'pending',
  //   ADD THIS LINE
  PENDING_RESUME = 'pending_resume', 
  
  IN_PROGRESS = 'in_progress',
  WAITING_REVIEW = 'waiting_review',
  PENDING_APPROVAL = 'pending_approval', 
  APPLIED = 'applied',
  FAILED = 'failed',
  REVIEW_REQUIRED = 'review_required',
  VIEWED = 'viewed',
  INTERVIEW = 'interview',
  REJECTED = 'rejected',
  OFFER = 'offer',
  CANCELLED = 'CANCELLED',
}