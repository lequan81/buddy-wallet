import { injectable, inject } from 'tsyringe';
import { Elysia, t } from 'elysia';
import { actor, permissionPlugin } from '@/app/Providers/Plugins';
import type { AuthenticatedElysiaContext } from '@/types/elysia';
import { CreateDebtSchema, UpdateDebtSchema } from '@repo/schema';
import { GEN_ERRORS } from '@repo/errors';
import { apiSuccess, apiError, isFailureResult } from '@/lib/http';
import { GetDebtsAction } from '@/app/Actions/Debt/GetDebtsAction';
import { CreateDebtAction } from '@/app/Actions/Debt/CreateDebtAction';
import { UpdateDebtAction } from '@/app/Actions/Debt/UpdateDebtAction';
import { DeleteDebtAction } from '@/app/Actions/Debt/DeleteDebtAction';
import { FindByIdAction } from '@/app/Actions/Debt/FindByIdAction';
import { FindSummaryAction } from '@/app/Actions/Debt/FindSummaryAction';
import { UpdateDebtStatusAction } from '@/app/Actions/Debt/UpdateDebtStatusAction';
import { SuggestEditAction } from '@/app/Actions/Debt/SuggestEditAction';
import { RespondToSuggestionAction } from '@/app/Actions/Debt/RespondToSuggestionAction';
import { ConfirmDebtAction } from '@/app/Actions/Debt/ConfirmDebtAction';

@injectable()
export class DebtController {
  constructor(
    @inject(GetDebtsAction) private getDebtsAction: GetDebtsAction,
    @inject(CreateDebtAction) private createDebtAction: CreateDebtAction,
    @inject(UpdateDebtAction) private updateDebtAction: UpdateDebtAction,
    @inject(DeleteDebtAction) private deleteDebtAction: DeleteDebtAction,
    @inject(FindByIdAction) private findByIdAction: FindByIdAction,
    @inject(FindSummaryAction) private findSummaryAction: FindSummaryAction,
    @inject(UpdateDebtStatusAction) private updateDebtStatusAction: UpdateDebtStatusAction,
    @inject(SuggestEditAction) private suggestEditAction: SuggestEditAction,
    @inject(RespondToSuggestionAction) private respondToSuggestionAction: RespondToSuggestionAction,
    @inject(ConfirmDebtAction) private confirmDebtAction: ConfirmDebtAction
  ) { }

  register(app: Elysia): any {
    return app.group('/debts', (group) =>
      group
        .use(actor)
        .use(permissionPlugin)
        // @ts-expect-error macro
        .requireActor(true)

        // Get debt summary
        .get('/summary', async (ctx: any) => {
          const { actor } = ctx as AuthenticatedElysiaContext;
          const summary = await this.findSummaryAction.execute(actor!.id);
          return apiSuccess(summary);
        })

        // List all debts (with filters)
        .get('/', async (ctx: any) => {
          const { actor, query } = ctx as AuthenticatedElysiaContext;
          const debts = await this.getDebtsAction.execute(actor!.id, query);
          return apiSuccess(debts);
        })

        // Create new debt
        .post('/', async (ctx: any) => {
          const { actor, body, set } = ctx as AuthenticatedElysiaContext<any>;
          const result = await this.createDebtAction.execute(body, actor!);

          if (isFailureResult(result)) {
            set.status = 400;
            return apiError(GEN_ERRORS.INVALID_INPUT, result.error);
          }

          return apiSuccess(result.data);
        }, {
          body: CreateDebtSchema
        })

        // Get single debt
        .get('/:id', async (ctx: any) => {
          const { params, set } = ctx as AuthenticatedElysiaContext;
          const debt = await this.findByIdAction.execute(params.id);

          if (!debt) {
            set.status = 404;
            return apiError(GEN_ERRORS.NOT_FOUND, 'Debt not found');
          }

          return apiSuccess(debt);
        })

        // Update debt
        .patch('/:id', async (ctx: any) => {
          const { actor, params, body, set } = ctx as AuthenticatedElysiaContext<any>;
          const result = await this.updateDebtAction.execute(params.id, body, actor!);

          if (isFailureResult(result)) {
            set.status = result.code === 'NOT_FOUND' ? 404 : 400;
            return apiError(GEN_ERRORS.INVALID_INPUT, result.error);
          }

          return apiSuccess(result.data);
        }, {
          body: UpdateDebtSchema
        })

        // Delete debt
        .delete('/:id', async (ctx: any) => {
          const { actor, params, set } = ctx as AuthenticatedElysiaContext;
          const result = await this.deleteDebtAction.execute(params.id, actor!);

          if (isFailureResult(result)) {
            set.status = result.code === 'NOT_FOUND' ? 404 : 400;
            return apiError(GEN_ERRORS.INVALID_INPUT, result.error);
          }

          return apiSuccess({ message: 'Debt deleted successfully' });
        })

        // Update status (Mark as Paid, Cancel, etc)
        .post('/:id/status', async (ctx: any) => {
          const { actor, params, body, set } = ctx as AuthenticatedElysiaContext<any>;
          const result = await this.updateDebtStatusAction.execute(params.id, body.status as any, actor!);

          if (isFailureResult(result)) {
            set.status = 400;
            return apiError(GEN_ERRORS.INVALID_INPUT, result.error);
          }

          return apiSuccess(result.data);
        }, {
          body: t.Object({
            status: t.String(),
            note: t.Optional(t.String())
          })
        })

        // Confirm debt (the other party acknowledges the debt)
        .post('/:id/confirm', async (ctx: any) => {
          const { actor, params, set } = ctx as AuthenticatedElysiaContext;
          const result = await this.confirmDebtAction.execute(params.id, actor!);

          if (isFailureResult(result)) {
            set.status = 400;
            return apiError(GEN_ERRORS.INVALID_INPUT, result.error);
          }

          return apiSuccess(result.data);
        })

        // Suggest changes (dispute or correction)
        .post('/:id/suggest', async (ctx: any) => {
          const { actor, params, body, set } = ctx as AuthenticatedElysiaContext<any>;
          const result = await this.suggestEditAction.execute(params.id, actor!, body);

          if (isFailureResult(result)) {
            set.status = 400;
            return apiError(GEN_ERRORS.INVALID_INPUT, result.error);
          }

          return apiSuccess(result.data);
        }, {
          body: t.Object({
            amount: t.Optional(t.Number()),
            description: t.Optional(t.String()),
            dueDate: t.Optional(t.String()),
            note: t.String()
          })
        })

        // Respond to suggestion (Accept/Reject)
        .post('/:id/suggest/:suggestionId/respond', async (ctx: any) => {
          const { actor, params, body, set } = ctx as AuthenticatedElysiaContext<any>;
          const result = await this.respondToSuggestionAction.execute(params.id, actor!, body.action === 'accept');

          if (isFailureResult(result)) {
            set.status = 400;
            return apiError(GEN_ERRORS.INVALID_INPUT, result.error);
          }

          return apiSuccess(result.data);
        }, {
          body: t.Object({
            action: t.Union([t.Literal('accept'), t.Literal('reject')]),
            note: t.Optional(t.String())
          })
        })
    );
  }
}
