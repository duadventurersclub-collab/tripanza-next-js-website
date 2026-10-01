import Link from "next/link";
import HostPrivatePage from "@/components/host/HostPrivatePage";
import { getPrivateHostData } from "@/lib/host";
import type { UserWallet } from "@/lib/wp";

const money = (value: number) => `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export default function HostWalletPage() {
  return <HostPrivatePage path="/host-wallet">{async () => {
    const wallet = await getPrivateHostData<UserWallet>("host/wallet");
    if (!wallet) return <div className="host-empty"><h3>Wallet is unavailable.</h3><p>Refresh or contact host support.</p></div>;
    return <><div className="host-toolbar"><div><span className="host-eyebrow">HOST MONEY</span><h1 className="host-title">Your wallet.<br /><em>Your moves.</em></h1><p className="host-copy">Track available funds and every money movement.</p></div><Link className="host-button" href="/host-payout-details">Payout details <span>→</span></Link></div><div className="host-grid four"><div className="host-card host-metric"><small>Available balance</small><strong>{money(wallet.balance)}</strong></div><div className="host-card host-metric"><small>Commission</small><strong>{money(wallet.source_balances.commission)}</strong></div><div className="host-card host-metric"><small>Cashback</small><strong>{money(wallet.source_balances.cashback)}</strong></div><div className="host-card host-metric"><small>Other</small><strong>{money(wallet.source_balances.general)}</strong></div></div><section className="host-section"><div className="host-section-head"><div><span className="host-eyebrow">WALLET ACTIVITY</span><h2>Money <em>moves.</em></h2></div></div>{wallet.transactions.length ? <div className="host-table-wrap"><table className="host-table"><thead><tr><th>Date</th><th>Activity</th><th>Source</th><th>Amount</th></tr></thead><tbody>{wallet.transactions.map(item => <tr key={item.id}><td>{item.date}</td><td>{item.description}</td><td>{item.source}</td><td>{item.type === "credit" ? "+" : "−"}{money(item.amount)}</td></tr>)}</tbody></table></div> : <div className="host-empty"><h3>No wallet activity yet.</h3><p>Your eligible earnings will appear here after confirmed bookings.</p></div>}</section></>;
  }}</HostPrivatePage>;
}
