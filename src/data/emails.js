// exports.welcomeEmail = `<!DOCTYPE html>
// <html>
//   <head>
//     <meta charset="utf-8">
//     <title>Welcome to Dorewa</title>
//     <style>
//       /* Add your CSS styles here */
//       body {
//         font-family: Arial, sans-serif;
//         color: #333;
//       }
//       h1 {
//         color: #0a84ae;
//       }
//       p {
//         line-height: 1.5;
//       }
//       .button {
//         display: inline-block;
//         padding: 10px 20px;
//         border: 1px solid #0a84ae;
//         border-radius: 3px;
//         color: #fff;
//         background-color: #0a84ae;
//         text-decoration: none;
//       }
//       .button:hover {
//         background-color: #0972a0;
//       }
//     </style>
//   </head>
//   <body>
//     <h1>Welcome to Dorewa</h1>
//     <p>Thank you for signing up for Eaze. We're excited to have you on board!</p>
//     <p>To get started, click the button below to log in to your account:</p>
//     <a href="#" class="button">Log In</a>
//     <p>If you have any questions, don't hesitate to contact us. We're here to help.</p>
//     <p>Sincerely,<br>Sodiq Farayola</p>
//   </body>
// </html>
// `;

export const verifyEmail = (name, pin) => `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Verify your Email</title>
    <style>
      /* Add your CSS styles here */
      body {
        font-family: Arial, sans-serif;
        color: #333;
      }
      h1 {
        color: #0a84ae;
      }
      p {
        line-height: 1.5;
      }
      .button {
        display: inline-block;
        padding: 10px 20px;
        border: 1px solid #0a84ae;
        border-radius: 3px;
        color: #fff;
        background-color: #0a84ae;
        text-decoration: none;
      }
      .button:hover {
        background-color: #0972a0;
      }
    </style>
  </head>
  <body>
    <h1>Verification Token</h1>
    <p>Hi ${name}</p>
    <p>Use the pin below to verify your email:</p>
    <p>${pin}</p>
    <p>If you have any questions, don't hesitate to contact us. We're here to help.</p>
    <p>Sincerely,<br>SUBSUM Support Team</p>
  </body>
</html>
`;

export const welcomeEmail = (email, firstName) => `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to SUBSUM</title>
    <style>
        body {
            font-family: 'Arial', sans-serif;
            margin: 0;
            padding: 0;
            background-color: #f9f9f9;
        }
        .container {
            max-width: 600px;
            margin: 20px auto;
            padding: 20px;
            background-color: #ffffff;
            border-radius: 10px;
            box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.1);
        }
        h1, h2 {
            color: #333333;
        }
        p {
            color: #555555;
            line-height: 1.6;
        }
        .btn {
            display: inline-block;
            padding: 12px 24px;
            background-color: #007bff;
            color: #ffffff;
            text-decoration: none;
            border-radius: 5px;
            transition: background-color 0.3s ease;
        }
        .btn:hover {
            background-color: #0056b3;
        }
        .footer {
            margin-top: 20px;
            text-align: center;
            color: #888888;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="container">
        <p>Welcome to SUBSUM and thank you for beginning your journey.</p>
        
        
        <p>If you have any questions or queries, kindly email <a href="mailto:support@subsum.io">support@subsum.io</a>.</p>
        <p>We wish to keep you fully informed about how SUBSUM works - so if you haven’t had a presentation and live demonstration of the platform, please <a href="https://calendly.com/sular/30min">click here</a> and we will walk you through the whole process.</p>
        <p>We look forward to sustaining the future of the world with you!</p>
        <p style="text-align: center;"><em>Warm Regards,</em><br>The SUBSUM Support Team</p>
        <div class="footer">            
            <p>31, 441 Crescent,CITEC Villa, Gwarinpa, Abuja<br></p>
        </div>
    </div>
</body>
</html>
`;

export const resetPassword = (email, pin) => `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Password</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
            background-color: #f9f9f9;
        }
        .container {
            max-width: 600px;
            margin: 20px auto;
            padding: 20px;
            background-color: #ffffff;
            border-radius: 10px;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
        }
        h1, p {
            color: #333333;
            margin: 0;
            margin-bottom: 10px;
        }
        .button {
            display: inline-block;
            padding: 12px 24px;
            background-color: #48a928;
            color: #ffffff;
            text-decoration: none;
            border-radius: 5px;
            transition: background-color 0.3s ease;
        }
        .button:hover {
            background-color: #3c8023;
        }
        .footer {
            margin-top: 20px;
            text-align: center;
            color: #888888;
            font-size: 14px;
        }
        .footer p {
            margin-top: 20px;
            color: #48a928;
        }
        .logo {
            display: block;
            margin: 20px auto;
            width: 200px;
            height: auto;
            background-color: #48a928
        }
        .support {
          margin-top: 10px
        }
    </style>
</head>
<body>
    <div class="container">
        <p>Hello ${email},</p>
        <p>A request has been received to change the password for your SUBSUM account.</p>
        <p>Your reset pin is ${pin}</p>
        <p class'support'>If you did not initiate this request, please contact us immediately at <a href="mailto:support@subsum.io">support@subsum.io</a>.</p>
        <p>Thank you,<br>The SUBSUM Team</p>
    </div>
    <div class="footer">
        <p>© SUBSUM 31, 441 Crescent, CITEC Villa, Gwarinpa, Abuja</p>
    </div>
</body>
</html>
`;

export const inviteEmail = (email, firstName, role) => `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invited to SangaBooks</title>
    <style>
        body {
            font-family: 'Arial', sans-serif;
            margin: 0;
            padding: 0;
            background-color: #f9f9f9;
        }
        .container {
            max-width: 600px;
            margin: 20px auto;
            padding: 20px;
            background-color: #ffffff;
            border-radius: 10px;
            box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.1);
        }
        h1, h2 {
            color: #333333;
        }
        p {
            color: #555555;
            line-height: 1.6;
        }
        .btn {
            display: inline-block;
            padding: 12px 24px;
            background-color: #007bff;
            color: #ffffff;
            text-decoration: none;
            border-radius: 5px;
            transition: background-color 0.3s ease;
        }
        .btn:hover {
            background-color: #0056b3;
        }
        .footer {
            margin-top: 20px;
            text-align: center;
            color: #888888;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="container">
        <p>Hi there ${firstName}, </p>
        <p>You've been invited to join the team at SangaBooks as an ${role}.</p>
        
        
        <p>If you have any questions or queries, kindly email <a href="mailto:support@sangabooks.io">support@sangabooks.io</a>.</p>
        
        <p style="text-align: center;"><em>Warm Regards,</em><br>The SangaBooks Support Team</p>
        <div class="footer">            
            <p>31, 441 Crescent,CITEC Villa, Gwarinpa, Abuja<br></p>
        </div>
    </div>
</body>
</html>
`;
