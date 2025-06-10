"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailNewAccount = exports.checkEmail = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
/**
 * Sends an email using nodemailer
 */
function sendEmail(emailOptions, mailAuth) {
    const transporter = nodemailer_1.default.createTransport({
        service: 'gmail',
        auth: mailAuth
    });
    return new Promise((resolve, reject) => {
        transporter.sendMail(emailOptions, (error, info) => {
            if (error) {
                console.log('Error sending email:', error);
                reject(error);
            }
            else {
                console.log('Email sent:', info.response);
                resolve();
            }
        });
    });
}
/**
 * Checks if an email is valid
 */
function checkEmail(controller) {
    const email = controller.req.body.email;
    return email && email.includes('@');
}
exports.checkEmail = checkEmail;
/**
 * Sends a new account email
 */
async function emailNewAccount(config) {
    const { email, controller, mailAuth } = config;
    const websiteName = controller.website.config.name;
    const emailOptions = {
        from: mailAuth.user,
        to: email,
        subject: `Welcome to ${websiteName}`,
        html: `
      <h1>Welcome to ${websiteName}</h1>
      <p>Your account has been created successfully.</p>
      <p>You can now log in to your account.</p>
    `
    };
    await sendEmail(emailOptions, mailAuth);
}
exports.emailNewAccount = emailNewAccount;
//# sourceMappingURL=email.js.map