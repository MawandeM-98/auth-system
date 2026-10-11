const nodemailer = require('nodemailer');
let transporter;

async function getTransporter() {
  if (transporter) return transporter;
  let auth = { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS };
  if (!auth.user) {
    const test = await nodemailer.createTestAccount();
    auth = { user: test.user, pass: test.pass };
  }
 transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  auth,
  tls: {
    rejectUnauthorized: false
  }
});
  return transporter;
}

module.exports.sendMail = async ({ to, subject, html }) => {
  const t = await getTransporter();
  const info = await t.sendMail({
    from: '"Auth System" <no-reply@auth.local>',
    to,
    subject,
    html
  });
  const preview = nodemailer.getTestMessageUrl(info);
  if (preview) console.log('Email preview URL:', preview);
};