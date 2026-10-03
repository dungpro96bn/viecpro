'use client';
import { useEffect, useState } from 'react';
import { PLAN_CATALOG, type PlanKey } from '@viecpro/shared';
import { apiRequest } from '@/lib/api';
import './plans.css';
type Order = { id: string; code: string; planKey: string; amountVnd: number; status: string; createdAt: string };
type Account = { plan: { name: string; expiresAt: string; jobQuota: number; jobsVisible: number; boostQuota: number; boostsUsed: number } | null };
const money = (v: number) => new Intl.NumberFormat('vi-VN').format(v) + 'đ';
export default function PlansPage() {
  const [orders,setOrders]=useState<Order[]>([]); const [account,setAccount]=useState<Account|null>(null); const [busy,setBusy]=useState(false); const [error,setError]=useState('');
  const reload=async()=>{const [h,m]=await Promise.all([apiRequest<Order[]>('/employer/billing/orders'),apiRequest<Account>('/employer/me')]);setOrders(h);setAccount(m);};
  useEffect(()=>{void reload().catch(()=>setError('Không tải được thông tin gói dịch vụ.'));},[]);
  const buy=async(key:PlanKey)=>{setBusy(true);setError('');try{const order=await apiRequest<{checkoutUrl:string}>('/employer/billing/orders',{method:'POST',body:JSON.stringify({planKey:key})});window.location.assign(order.checkoutUrl);}catch(e){setError(e instanceof Error?e.message:'Không tạo được đơn thanh toán.');setBusy(false);}};
  return <main className="plans-page"><header><p className="plans-eyebrow">Gói dịch vụ</p><h1>Chọn gói phù hợp</h1><p>Theo dõi số tin đang hiển thị, lượt đẩy và thời hạn gói.</p></header>
  {account?.plan&&<section className="plans-current"><div><span>Gói hiện tại</span><h2>{account.plan.name}</h2></div><p>{account.plan.jobsVisible}/{account.plan.jobQuota} tin đang hiển thị</p><p>{Math.max(0,account.plan.boostQuota-account.plan.boostsUsed)} lượt đẩy còn lại</p><p>Hết hạn {new Date(account.plan.expiresAt).toLocaleDateString('vi-VN')}</p></section>}
  {error&&<p role="alert" className="plans-error">{error}</p>}<section className="plans-grid">{Object.values(PLAN_CATALOG).filter(p=>p.priceVnd>0).map(plan=><article key={plan.key}><h2>{plan.name}</h2><strong>{money(plan.priceVnd)}<small> / {plan.durationDays} ngày</small></strong><p>Tối đa {plan.jobQuota} tin hiển thị</p><p>{plan.boostQuota} lượt đẩy tin</p><button disabled={busy} onClick={()=>void buy(plan.key)}>Mua / gia hạn</button></article>)}</section>
  <section className="plans-history"><h2>Lịch sử giao dịch</h2><div className="plans-table"><div className="plans-row plans-head"><span>Mã</span><span>Gói</span><span>Số tiền</span><span>Trạng thái</span><span>Ngày tạo</span></div>{orders.map(o=><div className="plans-row" key={o.id}><span>{o.code}</span><span>{PLAN_CATALOG[o.planKey as PlanKey]?.name??o.planKey}</span><span>{money(o.amountVnd)}</span><span>{o.status}</span><span>{new Date(o.createdAt).toLocaleDateString('vi-VN')}</span></div>)}{orders.length===0&&<p>Chưa có giao dịch.</p>}</div></section></main>;
}
