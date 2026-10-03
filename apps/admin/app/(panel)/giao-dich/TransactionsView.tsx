'use client';
import { useEffect, useState } from 'react';
import { PLAN_CATALOG, type PlanKey } from '@viecpro/shared';
import { api } from '@/lib/api';
import { errorText, dateTime } from '@/components/list/list-utils';
type Order={id:string;code:string;planKey:string;amountVnd:number;status:string;provider:string;createdAt:string;employerId:string|null;recruiterId:string|null};
const money=(n:number)=>new Intl.NumberFormat('vi-VN').format(n)+'đ';
export default function TransactionsView(){const [rows,setRows]=useState<Order[]>([]);const [error,setError]=useState('');useEffect(()=>{void api<Order[]>('/admin/billing/orders').then(setRows).catch(e=>setError(errorText(e)));},[]);return <section className="list-page"><header className="list-page__header"><div><p className="list-eyebrow">Tài chính</p><h1>Giao dịch</h1><p>Đơn thanh toán gói dịch vụ.</p></div></header>{error&&<p role="alert">{error}</p>}<div className="list-table-wrap"><table className="list-table"><thead><tr><th>Mã</th><th>Gói</th><th>Nhà tuyển dụng</th><th>Số tiền</th><th>Trạng thái</th><th>Cổng</th><th>Ngày tạo</th></tr></thead><tbody>{rows.map(x=><tr key={x.id}><td>{x.code}</td><td>{PLAN_CATALOG[x.planKey as PlanKey]?.name??x.planKey}</td><td>{x.employerId??x.recruiterId}</td><td>{money(x.amountVnd)}</td><td>{x.status}</td><td>{x.provider}</td><td>{dateTime(x.createdAt)}</td></tr>)}</tbody></table>{rows.length===0&&<p>Chưa có giao dịch.</p>}</div></section>}
