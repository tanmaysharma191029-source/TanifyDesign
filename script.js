/***********************
 * GLOBAL CONFIG
 ***********************/
const BACKEND_URL =
  (location.hostname === "127.0.0.1" || location.hostname === "localhost")
    ? "http://127.0.0.1:3002"
    : "https://<your-hosted-backend>"; // set your live API here

const UPI_ID      = "8440932404@axl";
const MANUAL_PAY  = "8440932404";
const WA          = "918741872408";
const OFFER_END   = new Date(2025, 10, 21, 23, 59, 59); // 21 Nov (month index 10)

/* Base prices */
const PRICES = {
  thumbnail: { single:79, triple:149, ten:449 },
  logo:      { basic:99 },
  banner:    { basic:149 },
  poster:    { basic:199 },
  video:     { long:299, shorts:99, vlog:149, faceless_long:399, faceless_shorts:149 }
};

/* TANIFY50 — unlimited uses with service-wise discounts */
const COUPON_NAME = "TANIFY50";
const COUPON_RULE = {
  thumbnail: 50,  // %
  logo:      40,
  banner:    30,
  poster:    30,
  video:     20
};

let _pendingOrder = null;     // data prepared before backend call
let _lastCreatedOrder = null; // data after backend (or offline)

/*********************** BOOT ************************/
document.addEventListener("DOMContentLoaded", () => {
  // block accidental submits/reloads
  document.addEventListener("submit", (e)=> e.preventDefault(), true);
  document.addEventListener("keydown", (e)=>{
    if (e.key === "Enter" && e.target && e.target.closest("#orderForm")) e.preventDefault();
  }, true);

  setupNavSmoothScroll();
  hydrateOfferBanner();
  wirePricingChooseButtons();
  setupOrderForm();
  renderLastOrderCard();
  setupFAQ();
  wirePopupButtons();

  // prevent closing by clicking backdrop
  const backdrop = document.getElementById("payPopup");
  if (backdrop) {
    backdrop.addEventListener("click", (ev)=>{
      if (ev.target === backdrop) ev.stopPropagation();
    });
  }
});

/*********************** NAV *************************/
function setupNavSmoothScroll(){
  document.querySelectorAll('[data-scroll]').forEach(a=>{
    a.addEventListener('click', ()=>{
      document.querySelectorAll('.links a').forEach(x=>x.classList.remove('active'));
      a.classList.add('active');
      document.querySelector(a.getAttribute('data-scroll'))?.scrollIntoView({behavior:'smooth'});
    });
  });
}

/*********************** OFFER *************************/
function hydrateOfferBanner(){
  const box = document.querySelector(".offer-box");
  if(!box) return;
  function tick(){
    const left = OFFER_END - new Date();
    if(left<=0){ box.innerHTML="Offer ended — ask on WhatsApp for next offer"; box.style.color="#666"; return; }
    const d=Math.floor(left/86400000), h=Math.floor(left%86400000/3600000), m=Math.floor(left%3600000/60000);
    box.innerHTML = `Offer valid till <b>21 November</b> • <b>${d}d ${String(h).padStart(2,'0')}h ${String(m).padStart(2,'0')}m</b> left`;
  }
  tick(); setInterval(tick,15000);
  const small=document.querySelector(".small"); if(small) small.innerHTML=`If payment doesn’t work → Pay manually to <b>${MANUAL_PAY}</b>`;
}

/*********************** PRICING -> ORDER *************************/
function wirePricingChooseButtons(){
  document.querySelectorAll(".choose").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const s=btn.dataset.service, p=btn.dataset.plan, a=PRICES?.[s]?.[p]??0;
      localStorage.setItem("service",s); localStorage.setItem("plan",p); localStorage.setItem("amount",String(a));
      document.querySelector("#order")?.scrollIntoView({behavior:'smooth'});
      setTimeout(setupOrderForm,200);
    });
  });
}

/*********************** ORDER FORM *************************/
function setupOrderForm(){
  const s=gid('service'), p=gid('plan'), line=gid('amtLine'), coupon=gid('coupon'), hint=gid('couponHint');
  if(!s||!p) return;

  // services
  s.innerHTML=[['thumbnail','Thumbnail'],['logo','Logo'],['banner','Banner'],['poster','Poster'],['video','Video Editing']]
    .map(([v,l])=>`<option value="${v}">${l}</option>`).join('');

  // prefill
  const savedS=localStorage.getItem('service')||'thumbnail';
  s.value=savedS;
  populatePlans(savedS,p);
  const savedP=localStorage.getItem('plan'); if(savedP&&p.querySelector(`option[value="${savedP}"]`)) p.value=savedP;

  recalc();

  s.addEventListener('change',()=>{populatePlans(s.value,p);p.selectedIndex=0;recalc();});
  p.addEventListener('change',recalc);
  coupon && coupon.addEventListener('input',recalc);

  function recalc(){
    const service = s.value;
    const plan    = p.value;
    const base    = PRICES?.[service]?.[plan] ?? 0;
    const { final, tag, note } = applyCoupon(base, service);

    line.style.fontSize = "18px";
    line.style.fontWeight = "800";
    line.style.marginTop = "8px";
    line.innerHTML = `Amount: <span style="color:#0a8f3d;font-weight:900;">₹${final}</span> ${tag || ""}`;

    if (final < base) {
      line.classList.remove("blink-green"); void line.offsetWidth; line.classList.add("blink-green");
      setTimeout(()=> line.classList.remove("blink-green"), 1000);
    }
    if(hint) hint.textContent = note || "";

    localStorage.setItem('service', service);
    localStorage.setItem('plan', plan);
    localStorage.setItem('amount', String(final));
  }
}

function populatePlans(service,select){
  const map={thumbnail:[['single','Single — ₹79'],['triple','Triple — ₹149'],['ten','Pack (10) — ₹449']],
             logo:[['basic','Logo — ₹99']], banner:[['basic','Banner — ₹149']], poster:[['basic','Poster — ₹199']],
             video:[['long','Long Edit — ₹299'],['shorts','Shorts — ₹99'],['vlog','Vlogging — ₹149'],['faceless_long','Faceless Long — ₹399'],['faceless_shorts','Faceless Shorts — ₹149']]};
  select.innerHTML=(map[service]||[]).map(([v,l])=>`<option value="${v}">${l}</option>`).join('');
}

/*********************** COUPON (unlimited uses, service-wise %) *************************/
function applyCoupon(baseAmount, service){
  const code = (gid("coupon")?.value || "").trim().toUpperCase();
  const out = { final: baseAmount, tag: "", note: "" };
  if(!code) return out;

  if(code !== COUPON_NAME){
    out.note = "Invalid coupon.";
    return out;
  }

  const pct = Number(COUPON_RULE[service] || 0);
  if (pct <= 0) {
    out.note = `${COUPON_NAME} not applicable for this service.`;
    return out;
  }

  const final = Math.max(0, Math.round(baseAmount * (100 - pct) / 100));
  out.final = final;
  out.tag   = `(${COUPON_NAME}: ${pct}% off)`;
  out.note  = `Applied: ${pct}% off on ${service}.`;
  return out;
}

/*********************** CONFIRM & PAY (Popup first; backend later) *************************/
function confirmOrder(ev){
  if (ev && typeof ev.preventDefault === "function") ev.preventDefault();

  const s=gid('service'), p=gid('plan'), t=gid('title'), n=gid('notes'); 
  if(!s||!p){alert("Service/Plan not found");return;}
  const service=s.value, plan=p.value, base=PRICES?.[service]?.[plan]??0, {final:amount}=applyCoupon(base,service);
  const title=(t?.value||"").trim(), notes=(n?.value||"").trim();
  const couponCode=(gid("coupon")?.value||"").trim().toUpperCase() || null;

  _pendingOrder = { service, plan, amount, title, notes, coupon: couponCode };
  showPayPopup(_pendingOrder);
}

/*********************** PLACE ORDER to backend (called on user choice) *************************/
async function placeOrderAndThen(action){
  if(!_pendingOrder){ alert("No order prepared"); return; }

  let orderId = null;

  try {
    const r = await fetch(`${BACKEND_URL}/api/order`, {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        plan:`${_pendingOrder.service}:${_pendingOrder.plan}`,
        category:_pendingOrder.service,
        topic:_pendingOrder.title,
        notes:_pendingOrder.notes,
        amount:_pendingOrder.amount,
        coupon:_pendingOrder.coupon
      })
    });
    const j = await r.json();
    if (!j?.ok) throw new Error("API not ok");
    orderId = j.id;
  } catch (e) {
    console.warn("Backend failed, using offline order:", e);
    orderId = "OFFLINE-" + Date.now();
    alert("Backend not reachable. Proceeding in offline mode.");
  }

  _lastCreatedOrder = { id: orderId, ..._pendingOrder };
  commitLastOrder(action); // save locally

  if(action === 'upi'){
    openUPI(_lastCreatedOrder.amount, `Tanify ${_lastCreatedOrder.service} ${_lastCreatedOrder.plan}`);
  }else if(action === 'whatsapp'){
    window.open(buildWhatsAppURL(_lastCreatedOrder), "_blank");
  }
}

/*********************** POPUP + ACTIONS *************************/
function wirePopupButtons(){
  gid("pp_directPay")?.addEventListener("click", ()=> placeOrderAndThen('upi'));
  gid("pp_whatsappFirst")?.addEventListener("click", ()=> placeOrderAndThen('whatsapp'));
  gid("pp_closeBtn")?.addEventListener("click", closePayPopup);
}

/*********************** POPUP SHOW/CLOSE *************************/
function showPayPopup(order){
  const wrap=gid("payPopup"), letter=gid("pp_letter"); if(!wrap) return;
  const eta=calcETA(order.service,order.plan);
  letter.textContent=
`Dear Tanify,

Please create the following:
• Service: ${order.service}
• Plan: ${order.plan}
• Title: ${order.title || "-"}
• Notes: ${order.notes || "-"}
• Amount: ₹${order.amount}

Delivery ETA: ${eta.label}

Thank you!`;
  wrap.style.display="flex";
}
function closePayPopup(){
  _pendingOrder = null; // cancel pending if user closes
  const wrap=gid("payPopup"); if(wrap) wrap.style.display="none";
}

/*********************** LAST ORDER *************************/
function renderLastOrderCard(){
  const box=gid('lastOrderBox'); if(!box) return;
  const o=safeJSON(localStorage.getItem("lastOrder")); if(!o){box.style.display="none";return;}
  const when=new Date(o.at||Date.now()).toLocaleString();
  const etaText=o.etaLabel ? o.etaLabel : (o.etaISO?("By "+new Date(o.etaISO).toLocaleDateString(undefined,{weekday:"short",day:"2-digit",month:"short",year:"numeric"})):"Soon");
  const method = o.method==="upi" ? "Chosen: Direct Pay (UPI)" :
                 o.method==="whatsapp" ? "Chosen: WhatsApp First" : "—";
  box.style.display="block";
  box.innerHTML=`
    <div style="font-weight:900;font-size:16px;margin-bottom:6px;">Your last order</div>
    <div style="font-size:14px;opacity:.9;margin-bottom:4px;">ID: <b>${o.id||"-"}</b></div>
    <div style="font-size:14px;opacity:.9;margin-bottom:6px;">Service: <b>${o.service}</b> • Plan: <b>${o.plan}</b> • Amount: <b>₹${o.amount}</b></div>
    <div style="font-size:13px;opacity:.95;margin-bottom:6px;"><b>Delivery ETA:</b> ${etaText}</div>
    <div class="small" style="margin-bottom:10px;opacity:.85;">${method}</div>
    <div style="font-size:12px;opacity:.6;">Saved on: ${when}</div>
  `;
}

/*********************** FAQ *************************/
function setupFAQ(){
  document.querySelectorAll(".faq-q").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      btn.classList.toggle("active");
      const next=btn.nextElementSibling; if(next?.classList.contains("faq-a")) next.style.display=btn.classList.contains("active")?"block":"none";
    });
  });
}

/*********************** UPI (generic deep-link; open on button click) *************************/
const amt2=v=>Number(v||0).toFixed(2);
function openUPI(amount, note){
  const params = new URLSearchParams({
    pa: UPI_ID,
    pn: "Tanmay Sharma",
    am: amt2(amount),
    cu: "INR",
    tn: (note || "").slice(0,25)
  }).toString();
  window.location.href = "upi://pay?" + params;
}

/*********************** ETA *************************/
function etaDays(service,plan){
  if(service==='thumbnail'){ if(plan==='single')return 0; if(plan==='triple')return 3; if(plan==='ten')return 5; }
  if(service==='logo')return 1; if(service==='banner')return 2; if(service==='poster')return 2;
  if(service==='video'){ if(plan==='shorts'||plan==='faceless_shorts')return 2; if(plan==='vlog')return 3; if(plan==='long'||plan==='faceless_long')return 5; }
  return 3;
}
function calcETA(service,plan){
  const add=etaDays(service,plan), now=new Date(), eta=new Date(now); eta.setDate(now.getDate()+add);
  let label = add===0 ? "Today (same day)" :
              add===1 ? "By tomorrow" :
              "By "+eta.toLocaleDateString(undefined,{weekday:"short",day:"2-digit",month:"short",year:"numeric"});
  return {days:add, iso:eta.toISOString(), label};
}

/*********************** HELPERS *************************/
function buildWhatsAppURL(o){
  const msg =
`New Order:
Service: ${o.service}
Plan: ${o.plan}
Amount: ₹${o.amount}
Title: ${o.title || "-"}
Notes: ${o.notes || "-"}
I will pay now.`;
  return `https://wa.me/${WA}?text=${encodeURIComponent(msg)}`;
}
function gid(id){ return document.getElementById(id); }
function safeJSON(s){ try{return JSON.parse(s||"null");}catch(_){return null;} }
window.confirmOrder = confirmOrder;
