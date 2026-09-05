const nodemailer = require("nodemailer");
const env = require("../config/env");

let transporter;

function quotationPortalUrl(quotationId) {
  const baseUrl = env.customerPortalUrl.replace(/\/$/, "");
  return `${baseUrl}/portal/quotations/${encodeURIComponent(quotationId)}`;
}

function buildQuotationEmail({ customer, quotation }) {
  const url = quotationPortalUrl(quotation.id);
  const subject = `Quotation ${quotation.id.slice(0, 8)} is ready for review`;
  const text = [
    `Hello ${customer.name},`,
    "",
    "Your DealFlow360 quotation is ready to review.",
    `Total: $${quotation.grandTotal}`,
    "",
    `Open quotation: ${url}`,
    "",
    "Sign in with the customer account registered to this email address.",
  ].join("\n");

  return { to: customer.email, subject, text, url };
}

function getTransporter() {
  if (!transporter) {
    const options = {
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.secure,
    };
    if (env.smtp.user || env.smtp.password) {
      options.auth = { user: env.smtp.user, pass: env.smtp.password };
    }
    transporter = nodemailer.createTransport(options);
  }
  return transporter;
}

async function sendQuotationEmail({ customer, quotation }) {
  const message = buildQuotationEmail({ customer, quotation });
  if (!env.smtp.host) {
    console.info("[mail] SMTP is not configured; quotation link was not emailed", {
      quotationId: quotation.id,
      to: customer.email,
      url: message.url,
    });
    return { status: "SKIPPED", reason: "SMTP_NOT_CONFIGURED" };
  }

  try {
    const info = await getTransporter().sendMail({
      from: env.smtp.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
    });
    return { status: "SENT", messageId: info.messageId };
  } catch (error) {
    console.error("[mail] quotation email failed", {
      quotationId: quotation.id,
      to: customer.email,
      message: error.message,
    });
    return { status: "FAILED" };
  }
}

module.exports = { buildQuotationEmail, quotationPortalUrl, sendQuotationEmail };
