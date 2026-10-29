/* Núcleo financeiro independente da interface. Todos os valores monetários são inteiros em centavos. */
(function (root) {
  'use strict';
  const SCHEMA_VERSION = 1;
  const DEFAULT_CATEGORIES = ['Moradia','Alimentação','Transporte','Saúde','Educação','Lazer','Compras','Assinaturas','Contas e serviços','Outros','Salário','Renda extra'];
  const clone = value => JSON.parse(JSON.stringify(value));
  const id = () => (root.crypto && root.crypto.randomUUID) ? root.crypto.randomUUID() : 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  const isIntCents = value => Number.isSafeInteger(value) && value >= 0;
  const validDate = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && (() => { const [y,m,d]=s.split('-').map(Number); const dt = new Date(y,m-1,d); return dt.getFullYear()===y && dt.getMonth()===m-1 && dt.getDate()===d; })();
  function todayISO() { const d = new Date(); return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-'); }
  function monthISO(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`; }
  function monthOf(date) { return String(date || '').slice(0,7); }
  function centsFromInput(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? Math.round(value * 100) : NaN;
    let s = String(value ?? '').trim().replace(/R\$\s?/gi,'').replace(/\s/g,'');
    if (!s) return NaN;
    // Aceita padrão brasileiro (1.234,56) e decimal simples (1234.56).
    if (s.includes(',') && s.includes('.')) s = s.replace(/\./g,'').replace(',','.'); else if (s.includes(',')) s = s.replace(',','.');
    if (!/^\d+(\.\d{1,2})?$/.test(s)) return NaN;
    const n = Number(s); return Number.isSafeInteger(Math.round(n*100)) ? Math.round(n*100) : NaN;
  }
  function initialState() {
    return {
      schemaVersion: SCHEMA_VERSION, demoMode: false, demoSettingsEdited: {}, cancelledOccurrences: [],
      settings: { salaryExpectedCents: 0, salaryDay: 5, currentBankBalanceCents: null, essentialMonths: 6, manualEmergencyTargetCents: null, alert70: 70, alert90: 90, categories: DEFAULT_CATEGORIES.slice() },
      transactions: [], bills: [], billTemplates: [], budgets: [],
      goals: [], emergencyInitialCents: 0
    };
  }
  function dateForDueDay(month, day) {
    const [year, mon] = month.split('-').map(Number);
    const last = new Date(year, mon, 0).getDate();
    return `${year}-${String(mon).padStart(2,'0')}-${String(Math.min(Math.max(1, Number(day)||1), last)).padStart(2,'0')}`;
  }
  function ensureRecurringOccurrences(state, month) {
    if (!/^\d{4}-\d{2}$/.test(month)) throw new Error('Mês inválido.');
    const existing = new Set(state.bills.map(b => b.occurrenceKey).filter(Boolean));
    const cancelled = new Set(state.cancelledOccurrences || []);
    let added = 0;
    state.billTemplates.filter(t => t.active !== false && t.recurrence === 'monthly').forEach(t => {
      const key = `${t.id}:${month}`;
      if (existing.has(key) || cancelled.has(key)) return;
      state.bills.push({ id: id(), templateId: t.id, occurrenceKey: key, name: t.name, category: t.category || 'Outros', amountCents: t.amountCents, dueDate: dateForDueDay(month, t.dueDay), status: 'pending', paidDate: null, paidAmountCents: null, essential: !!t.essential, notes: t.notes || '', demo: !!t.demo });
      existing.add(key); added++;
    });
    return added;
  }
  function monthTransactions(state, month) { return state.transactions.filter(t => monthOf(t.date) === month); }
  function monthBills(state, month) { return state.bills.filter(b => monthOf(b.dueDate) === month); }
  function sumCents(items, get = x => x.amountCents) { return items.reduce((total, item) => total + (Number.isSafeInteger(get(item)) ? get(item) : 0), 0); }
  function actualBillAmount(bill) { return bill.status === 'paid' ? (isIntCents(bill.paidAmountCents) ? bill.paidAmountCents : bill.amountCents) : bill.amountCents; }
  function isPaidTransaction(t) { return t.type === 'income' ? t.status === 'received' : t.type === 'expense' ? t.status === 'paid' : ['goal_contribution','emergency_contribution','goal_withdrawal','emergency_withdrawal'].includes(t.type) && t.status !== 'planned'; }
  function getGoalBalance(state, goal) {
    const ops = state.transactions.filter(t => t.goalId === goal.id && ['goal_contribution','goal_withdrawal'].includes(t.type) && t.status !== 'planned');
    return Math.max(0, (goal.initialCents || 0) + sumCents(ops.filter(t=>t.type==='goal_contribution')) - sumCents(ops.filter(t=>t.type==='goal_withdrawal')));
  }
  function getEmergencyBalance(state) {
    const ops = state.transactions.filter(t => ['emergency_contribution','emergency_withdrawal'].includes(t.type) && t.status !== 'planned');
    return Math.max(0, (state.emergencyInitialCents || 0) + sumCents(ops.filter(t=>t.type==='emergency_contribution')) - sumCents(ops.filter(t=>t.type==='emergency_withdrawal')));
  }
  function essentialsMonthlyEstimate(state, month) {
    const tx = monthTransactions(state, month).filter(t=>t.type==='expense' && t.status==='paid' && t.essential);
    const bills = monthBills(state, month).filter(b=>b.essential && b.status==='paid');
    return sumCents(tx) + sumCents(bills, actualBillAmount);
  }
  function calculateMonth(state, month) {
    const tx = monthTransactions(state, month);
    const bills = monthBills(state, month);
    const incomes = tx.filter(t=>t.type==='income');
    const salaryItems = incomes.filter(t => String(t.category||'').toLocaleLowerCase('pt-BR') === 'salário' || String(t.category||'').toLocaleLowerCase('pt-BR') === 'salario');
    const expectedSalary = salaryItems.length ? sumCents(salaryItems.filter(t=>t.status==='received' || t.status==='planned')) : (state.settings.salaryExpectedCents || 0);
    const otherIncomeProjected = sumCents(incomes.filter(t=>!salaryItems.includes(t) && ['received','planned'].includes(t.status)));
    const receivedIncome = sumCents(incomes.filter(t=>t.status==='received'));
    const projectedIncome = expectedSalary + otherIncomeProjected;
    const paidExpensesTx = tx.filter(t=>t.type==='expense' && t.status==='paid');
    const plannedExpensesTx = tx.filter(t=>t.type==='expense' && t.status==='planned');
    const paidBills = bills.filter(b=>b.status==='paid');
    const pendingBills = bills.filter(b=>b.status!=='paid');
    const paidExpenses = sumCents(paidExpensesTx) + sumCents(paidBills, actualBillAmount);
    const plannedExpenses = sumCents(plannedExpensesTx);
    const pendingBillsCents = sumCents(pendingBills);
    const goalContributions = sumCents(tx.filter(t=>t.type==='goal_contribution' && t.status!=='planned'));
    const goalWithdrawals = sumCents(tx.filter(t=>t.type==='goal_withdrawal' && t.status!=='planned'));
    const emergencyContributions = sumCents(tx.filter(t=>t.type==='emergency_contribution' && t.status!=='planned'));
    const emergencyWithdrawals = sumCents(tx.filter(t=>t.type==='emergency_withdrawal' && t.status!=='planned'));
    const committed = paidExpenses + plannedExpenses + pendingBillsCents;
    const allocatedNet = goalContributions - goalWithdrawals + emergencyContributions - emergencyWithdrawals;
    const projectedFree = projectedIncome - committed - allocatedNet;
    const actualFlow = receivedIncome - paidExpenses - goalContributions + goalWithdrawals - emergencyContributions + emergencyWithdrawals;
    const budgets = state.budgets.map(b => {
      const spentTx = sumCents(paidExpensesTx.filter(t=>t.category===b.category));
      const spentBills = sumCents(paidBills.filter(t=>t.category===b.category), actualBillAmount);
      const spent = spentTx + spentBills;
      const planned = sumCents(plannedExpensesTx.filter(t=>t.category===b.category));
      return { category:b.category, limitCents:b.limitCents, spentCents:spent, plannedCents:planned, remainingCents:b.limitCents-spent, percent:b.limitCents>0 ? spent/b.limitCents*100 : (spent>0 ? Infinity : 0) };
    });
    const emergencyBalance = getEmergencyBalance(state);
    const essentialEstimate = essentialsMonthlyEstimate(state, month) || state.settings.essentialBaselineCents || 0;
    const emergencyTarget = state.settings.manualEmergencyTargetCents != null ? state.settings.manualEmergencyTargetCents : essentialEstimate * (state.settings.essentialMonths || 0);
    return { month, expectedSalaryCents: expectedSalary, otherIncomeProjectedCents:otherIncomeProjected, projectedIncomeCents:projectedIncome, receivedIncomeCents:receivedIncome, paidExpensesCents:paidExpenses, plannedExpensesCents:plannedExpenses, pendingBillsCents:pendingBillsCents, committedCents:committed, goalContributionsCents:goalContributions, goalWithdrawalsCents:goalWithdrawals, emergencyContributionsCents:emergencyContributions, emergencyWithdrawalsCents:emergencyWithdrawals, allocatedNetCents:allocatedNet, projectedFreeCents:projectedFree, actualFlowCents:actualFlow, pendingBillsCount:pendingBills.length, paidBillsCount:paidBills.length, transactionCount:tx.length, budgets, emergencyBalanceCents:emergencyBalance, emergencyTargetCents:emergencyTarget, essentialMonthlyCents:essentialEstimate };
  }
  function categorySpent(state, month, category) {
    const tx = monthTransactions(state, month);
    const bill = monthBills(state, month);
    return sumCents(tx.filter(t=>t.type==='expense' && t.status==='paid' && t.category===category)) + sumCents(bill.filter(b=>b.status==='paid' && b.category===category), actualBillAmount);
  }
  function insights(state, month) {
    const calc = calculateMonth(state, month); const result = [];
    calc.budgets.forEach(b => {
      if (b.limitCents > 0 && b.percent >= 100) result.push({level:'red', text:`O orçamento de ${b.category} passou do limite (${Math.round(b.percent)}%).`});
      else if (b.limitCents > 0 && b.percent >= (state.settings.alert90 || 90)) result.push({level:'yellow', text:`Você já usou ${Math.round(b.percent)}% do limite de ${b.category} (alerta alto).`});
      else if (b.limitCents > 0 && b.percent >= (state.settings.alert70 || 70)) result.push({level:'yellow', text:`Você já usou ${Math.round(b.percent)}% do limite de ${b.category} (primeiro alerta).`});
    });
    const now = todayISO();
    monthBills(state, month).filter(b=>b.status!=='paid').forEach(b=>{
      if (b.dueDate < now) result.push({level:'red', text:`A conta “${b.name}” venceu em ${b.dueDate.split('-').reverse().join('/')}.`});
      else { const days = Math.round((new Date(...b.dueDate.split('-').map(Number).map((v,i)=>i===1?v-1:v)) - new Date())/86400000); if (days >= 0 && days <= 5) result.push({level:'yellow', text:`A conta “${b.name}” vence em ${b.dueDate.split('-').reverse().join('/')}.`}); }
    });
    if (calc.projectedFreeCents < 0) result.push({level:'red', text:`O planejamento está ${Math.abs(calc.projectedFreeCents)/100 > 0 ? 'negativo em '+formatBRL(calc.projectedFreeCents*-1) : 'negativo'}. Revise compromissos e aportes.`});
    if (!calc.transactionCount && !monthBills(state, month).length) result.push({level:'green', text:'Ainda não há movimentações ou contas neste mês. Cadastre seus dados para gerar análises úteis.'});
    state.goals.filter(g=>g.status==='active' && g.deadline).forEach(g=>{ const bal=getGoalBalance(state,g); const remaining=Math.max(0,g.targetCents-bal); const months=Math.max(1, monthsBetween(month+'-01',g.deadline)); if (remaining>0 && g.monthlyCents>0 && remaining/g.monthlyCents>months) result.push({level:'yellow',text:`O aporte atual de “${g.name}” pode não alcançar a meta até ${g.deadline.split('-').reverse().join('/')}.`}); });
    if (!result.length) result.push({level:'green',text:'Nenhum alerta relevante identificado com os dados disponíveis.'});
    return result;
  }
  function monthsBetween(fromDate, toDate) { if (!/^\d{4}-\d{2}-\d{2}$/.test(toDate)) return 0; const [fy,fm]=fromDate.split('-').map(Number),[ty,tm]=toDate.split('-').map(Number); return Math.max(0,(ty-fy)*12+tm-fm); }
  function formatBRL(cents) { return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format((Number(cents)||0)/100); }
  function validateState(s) {
    if (!s || typeof s !== 'object' || s.schemaVersion !== SCHEMA_VERSION) throw new Error('Backup incompatível: versão ou estrutura não reconhecida.');
    if (!s.settings || !Array.isArray(s.transactions) || !Array.isArray(s.bills) || !Array.isArray(s.billTemplates) || !Array.isArray(s.budgets) || !Array.isArray(s.goals)) throw new Error('Backup inválido: faltam seções obrigatórias.');
    if (!isIntCents(s.settings.salaryExpectedCents || 0)) throw new Error('Backup inválido: renda prevista incorreta.');
    if (s.settings.currentBankBalanceCents != null && !isIntCents(s.settings.currentBankBalanceCents)) throw new Error('Backup inválido: saldo bancário incorreto.');
    if (s.settings.manualEmergencyTargetCents != null && !isIntCents(s.settings.manualEmergencyTargetCents)) throw new Error('Backup inválido: meta da reserva incorreta.');
    if (s.settings.categories != null && (!Array.isArray(s.settings.categories) || s.settings.categories.some(c=>typeof c!=='string' || !c.trim()))) throw new Error('Backup inválido: categorias incorretas.');
    if (s.emergencyInitialCents != null && !isIntCents(s.emergencyInitialCents)) throw new Error('Backup inválido: saldo inicial da reserva incorreto.');
    if (s.cancelledOccurrences != null && (!Array.isArray(s.cancelledOccurrences) || s.cancelledOccurrences.some(k=>typeof k!=='string'))) throw new Error('Backup inválido: cancelamentos de recorrência incorretos.');
    s.transactions.forEach((t,i)=>{ if (!t.id || !['income','expense','goal_contribution','goal_withdrawal','emergency_contribution','emergency_withdrawal'].includes(t.type) || !isIntCents(t.amountCents) || t.amountCents<=0 || !validDate(t.date) || !['received','paid','planned'].includes(t.status)) throw new Error(`Backup inválido: movimentação ${i+1} contém campos incorretos.`); });
    s.bills.forEach((b,i)=>{ if (!b.id || !isIntCents(b.amountCents) || b.amountCents<=0 || !validDate(b.dueDate) || !['pending','paid'].includes(b.status) || (b.paidAmountCents!=null && !isIntCents(b.paidAmountCents)) || (b.paidDate!=null && !validDate(b.paidDate))) throw new Error(`Backup inválido: conta ${i+1} contém campos incorretos.`); });
    s.billTemplates.forEach((t,i)=>{ if (!t.id || typeof t.name!=='string' || !t.name.trim() || !isIntCents(t.amountCents) || t.amountCents<=0 || !Number.isInteger(t.dueDay) || t.dueDay<1 || t.dueDay>31 || t.recurrence!=='monthly') throw new Error(`Backup inválido: modelo recorrente ${i+1} contém campos incorretos.`); });
    s.budgets.forEach((b,i)=>{ if (!b.category || !isIntCents(b.limitCents)) throw new Error(`Backup inválido: orçamento ${i+1} incorreto.`); });
    s.goals.forEach((g,i)=>{ if (!g.id || typeof g.name!=='string' || !g.name.trim() || !isIntCents(g.targetCents) || g.targetCents<=0 || !isIntCents(g.initialCents || 0) || !isIntCents(g.monthlyCents || 0) || (g.deadline!=null && g.deadline!=='' && !validDate(g.deadline))) throw new Error(`Backup inválido: objetivo ${i+1} incorreto.`); });
    return true;
  }
  function demoState() {
    const s=initialState(); s.demoMode=true; s.settings.salaryExpectedCents=320000; s.settings.currentBankBalanceCents=282500; s.settings.essentialMonths=6; s.settings.categories=DEFAULT_CATEGORIES.slice();
    const thisMonth=monthISO(); const date=(day)=>dateForDueDay(thisMonth,day); const today=todayISO();
    s.billTemplates=[
      {id:'demo-rent',name:'Aluguel (exemplo)',category:'Moradia',amountCents:85000,dueDay:5,recurrence:'monthly',active:true,essential:true,notes:'Demonstração',demo:true},
      {id:'demo-power',name:'Energia (exemplo)',category:'Contas e serviços',amountCents:12000,dueDay:12,recurrence:'monthly',active:true,essential:true,notes:'Demonstração',demo:true},
      {id:'demo-internet',name:'Internet (exemplo)',category:'Contas e serviços',amountCents:9000,dueDay:20,recurrence:'monthly',active:true,essential:true,notes:'Demonstração',demo:true}
    ]; ensureRecurringOccurrences(s,thisMonth);
    s.bills.forEach(b=>{if(b.name.startsWith('Aluguel')){b.status='paid';b.paidDate=date(5);b.paidAmountCents=b.amountCents;}});
    s.transactions=[
      {id:'demo-salary',type:'income',amountCents:320000,date:date(5),category:'Salário',description:'Salário previsto/recebido (exemplo)',account:'',status:'received',essential:false,demo:true},
      {id:'demo-grocery',type:'expense',amountCents:24500,date:today,category:'Alimentação',description:'Mercado (exemplo)',account:'Débito',status:'paid',essential:true,demo:true},
      {id:'demo-bus',type:'expense',amountCents:6500,date:today,category:'Transporte',description:'Transporte (exemplo)',account:'Cartão',status:'paid',essential:true,demo:true},
      {id:'demo-leisure',type:'expense',amountCents:4500,date:today,category:'Lazer',description:'Lazer (exemplo)',account:'Pix',status:'paid',essential:false,demo:true}
    ];
    s.budgets=[{category:'Alimentação',limitCents:45000,demo:true},{category:'Transporte',limitCents:20000,demo:true},{category:'Lazer',limitCents:15000,demo:true},{category:'Compras',limitCents:25000,demo:true}];
    s.goals=[{id:'demo-goal',name:'Computador (exemplo)',targetCents:400000,initialCents:50000,deadline:null,monthlyCents:30000,priority:'high',status:'active',kind:'Compra',demo:true}];
    s.transactions.push({id:'demo-aporte',type:'goal_contribution',amountCents:20000,date:today,category:'Objetivos',description:'Aporte de exemplo',account:'',status:'paid',goalId:'demo-goal',essential:false,demo:true});
    s.emergencyInitialCents=100000; s.settings.manualEmergencyTargetCents=null;
    return s;
  }
  const api={SCHEMA_VERSION,DEFAULT_CATEGORIES,clone,id,validDate,todayISO,monthISO,monthOf,centsFromInput,initialState,dateForDueDay,ensureRecurringOccurrences,monthTransactions,monthBills,sumCents,actualBillAmount,getGoalBalance,getEmergencyBalance,essentialsMonthlyEstimate,calculateMonth,categorySpent,insights,monthsBetween,formatBRL,validateState,demoState};
  root.FinanceCore=api;
  if (typeof module!=='undefined' && module.exports) module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
