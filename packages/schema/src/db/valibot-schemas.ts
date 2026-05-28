import { createSelectSchema, createInsertSchema } from 'drizzle-valibot';
import * as v from 'valibot';
import {
  users,
  debts,
  sessions,
  importLogs,
  pushSubscriptions,
  activityLogs,
  bankAccounts,
  emailVerifications,
  outboxEvents,
  notifications,
  paymentProofs,
  debtStatusHistory,
  debtSuggestions
} from './index';

// Select schemas
export const selectUserSchema = createSelectSchema(users);
export const selectDebtSchema = createSelectSchema(debts);
export const selectSessionSchema = createSelectSchema(sessions);
export const selectImportLogSchema = createSelectSchema(importLogs);
export const selectPushSubscriptionSchema = createSelectSchema(pushSubscriptions);
export const selectActivityLogSchema = createSelectSchema(activityLogs);
export const selectBankAccountSchema = createSelectSchema(bankAccounts);
export const selectEmailVerificationSchema = createSelectSchema(emailVerifications);
export const selectOutboxEventSchema = createSelectSchema(outboxEvents);
export const selectNotificationSchema = createSelectSchema(notifications);
export const selectPaymentProofSchema = createSelectSchema(paymentProofs);
export const selectDebtStatusHistorySchema = createSelectSchema(debtStatusHistory);
export const selectDebtSuggestionSchema = createSelectSchema(debtSuggestions);

// Insert schemas
export const insertUserSchema = createInsertSchema(users);
export const insertDebtSchema = createInsertSchema(debts);
export const insertSessionSchema = createInsertSchema(sessions);
export const insertImportLogSchema = createInsertSchema(importLogs);
export const insertPushSubscriptionSchema = createInsertSchema(pushSubscriptions);
export const insertActivityLogSchema = createInsertSchema(activityLogs);
export const insertBankAccountSchema = createInsertSchema(bankAccounts);
export const insertEmailVerificationSchema = createInsertSchema(emailVerifications);
export const insertOutboxEventSchema = createInsertSchema(outboxEvents);
export const insertNotificationSchema = createInsertSchema(notifications);
export const insertPaymentProofSchema = createInsertSchema(paymentProofs);
export const insertDebtStatusHistorySchema = createInsertSchema(debtStatusHistory);
export const insertDebtSuggestionSchema = createInsertSchema(debtSuggestions);

// Inferred Types
export type SelectUser = v.InferOutput<typeof selectUserSchema>;
export type InsertUser = v.InferOutput<typeof insertUserSchema>;
export type SelectDebt = v.InferOutput<typeof selectDebtSchema>;
export type InsertDebt = v.InferOutput<typeof insertDebtSchema>;
export type SelectSession = v.InferOutput<typeof selectSessionSchema>;
export type InsertSession = v.InferOutput<typeof insertSessionSchema>;
export type SelectImportLog = v.InferOutput<typeof selectImportLogSchema>;
export type InsertImportLog = v.InferOutput<typeof insertImportLogSchema>;
export type SelectPushSubscription = v.InferOutput<typeof selectPushSubscriptionSchema>;
export type InsertPushSubscription = v.InferOutput<typeof insertPushSubscriptionSchema>;
export type SelectActivityLog = v.InferOutput<typeof selectActivityLogSchema>;
export type InsertActivityLog = v.InferOutput<typeof insertActivityLogSchema>;
export type SelectBankAccount = v.InferOutput<typeof selectBankAccountSchema>;
export type InsertBankAccount = v.InferOutput<typeof insertBankAccountSchema>;
export type SelectEmailVerification = v.InferOutput<typeof selectEmailVerificationSchema>;
export type InsertEmailVerification = v.InferOutput<typeof insertEmailVerificationSchema>;
export type SelectOutboxEvent = v.InferOutput<typeof selectOutboxEventSchema>;
export type InsertOutboxEvent = v.InferOutput<typeof insertOutboxEventSchema>;
export type SelectNotification = v.InferOutput<typeof selectNotificationSchema>;
export type InsertNotification = v.InferOutput<typeof insertNotificationSchema>;
export type SelectPaymentProof = v.InferOutput<typeof selectPaymentProofSchema>;
export type InsertPaymentProof = v.InferOutput<typeof insertPaymentProofSchema>;
export type SelectDebtStatusHistory = v.InferOutput<typeof selectDebtStatusHistorySchema>;
export type InsertDebtStatusHistory = v.InferOutput<typeof insertDebtStatusHistorySchema>;
export type SelectDebtSuggestion = v.InferOutput<typeof selectDebtSuggestionSchema>;
export type InsertDebtSuggestion = v.InferOutput<typeof insertDebtSuggestionSchema>;
