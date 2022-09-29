import { ViewEntity, ViewColumn } from 'typeorm';
import { Balance } from '@admin-back/grpc';

@ViewEntity({
  name: 'balances',
  expression: `
    select
      a."user",
      a.id account,
      coalesce(a.initial_balance + daily_incomes - daily_expenses,     0) daily_balance,
      coalesce(daily_incomes,                                          0) daily_incomes,
      coalesce(daily_expenses,                                         0) daily_expenses,
      coalesce(a.initial_balance + monthly_incomes - monthly_expenses, 0) monthly_balance,
      coalesce(monthly_incomes,                                        0) monthly_incomes,
      coalesce(monthly_expenses,                                       0) monthly_expenses,
      coalesce(a.initial_balance + annual_incomes - annual_expenses,   0) annual_balance,
      coalesce(annual_incomes,                                         0) annual_incomes,
      coalesce(annual_expenses,                                        0) annual_expenses
    from (
       select
         sum(case when type = 'income'  and to_char(now(), 'YYYY-MM-DD') = to_char(date, 'YYYY-MM-DD') then amount end)::real daily_incomes,
         sum(case when type = 'expense' and to_char(now(), 'YYYY-MM-DD') = to_char(date, 'YYYY-MM-DD') then amount end)::real daily_expenses,
         sum(case when type = 'income'  and to_char(now(), 'YYYY-MM')    = to_char(date, 'YYYY-MM')    then amount end)::real monthly_incomes,
         sum(case when type = 'expense' and to_char(now(), 'YYYY-MM')    = to_char(date, 'YYYY-MM')    then amount end)::real monthly_expenses,
         sum(case when type = 'income'  and to_char(now(), 'YYYY')       = to_char(date, 'YYYY')       then amount end)::real annual_incomes,
         sum(case when type = 'expense' and to_char(now(), 'YYYY')       = to_char(date, 'YYYY')       then amount end)::real annual_expenses,
         "user",
         account_id
       from movements group by account_id, "user"
     ) as b
    right join accounts a on a.id = b.account_id;
  `,
})
export class BalanceEntity implements Balance {
  @ViewColumn()
  user: number;

  @ViewColumn()
  account: number;

  @ViewColumn({ name: 'daily_balance' })
  dailyBalance: number;

  @ViewColumn({ name: 'daily_incomes' })
  dailyIncomes: number;

  @ViewColumn({ name: 'daily_expenses' })
  dailyExpenses: number;

  @ViewColumn({ name: 'monthly_balance' })
  monthlyBalance: number;

  @ViewColumn({ name: 'monthly_incomes' })
  monthlyIncomes: number;

  @ViewColumn({ name: 'monthly_expenses' })
  monthlyExpenses: number;

  @ViewColumn({ name: 'annual_balance' })
  annualBalance: number;

  @ViewColumn({ name: 'annual_incomes' })
  annualIncomes: number;

  @ViewColumn({ name: 'annual_expenses' })
  annualExpenses: number;
}
