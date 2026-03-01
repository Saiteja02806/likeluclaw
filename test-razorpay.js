require('dotenv').config();
const Razorpay = require('razorpay');
const r = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

async function test() {
  try {
    console.log('Razorpay Key:', process.env.RAZORPAY_KEY_ID);
    
    const basic = await r.plans.fetch(process.env.RAZORPAY_PLAN_BASIC);
    console.log('Basic:', basic.id, basic.item.currency, basic.item.amount/100, basic.item.name);
    
    const pro = await r.plans.fetch(process.env.RAZORPAY_PLAN_PRO);
    console.log('Pro:', pro.id, pro.item.currency, pro.item.amount/100, pro.item.name);
    
    const biz = await r.plans.fetch(process.env.RAZORPAY_PLAN_BUSINESS);
    console.log('Business:', biz.id, biz.item.currency, biz.item.amount/100, biz.item.name);
    
    console.log('\nRazorpay LIVE connection: OK');
  } catch(e) {
    console.log('ERROR:', e.message);
    console.log('Status:', e.statusCode);
  }
}
test();
