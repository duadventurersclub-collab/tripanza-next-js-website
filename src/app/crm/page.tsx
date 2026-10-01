import HostPrivatePage from "@/components/host/HostPrivatePage";
import { getPrivateHostData } from "@/lib/host";

type Lead = { id: number; itinerary_title: string; customer_email: string; customer_phone: string; status: string; lead_temperature: string; sent_on: string };

export default function HostLeadsPage() {
  return <HostPrivatePage path="/crm">{async () => {
    const data = await getPrivateHostData<{ items: Lead[] }>("host/leads");
    return <><div className="host-toolbar"><div><span className="host-eyebrow">HOST CUSTOMER DESK</span><h1 className="host-title">Your leads.<br /><em>Your next crew.</em></h1><p className="host-copy">People who requested an itinerary for your hosted trips.</p></div></div>{data?.items.length ? <div className="host-table-wrap"><table className="host-table"><thead><tr><th>Lead</th><th>Trip</th><th>Email</th><th>Phone</th><th>Status</th><th>Received</th></tr></thead><tbody>{data.items.map(item => <tr key={item.id}><td>#{item.id}</td><td>{item.itinerary_title}</td><td>{item.customer_email}</td><td>{item.customer_phone}</td><td><span className="host-status">{item.status}</span></td><td>{item.sent_on}</td></tr>)}</tbody></table></div> : <div className="host-empty"><h3>No host leads yet.</h3><p>When a traveller requests your hosted itinerary, their request will appear here.</p></div>}</>;
  }}</HostPrivatePage>;
}
