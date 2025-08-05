import { createTransport } from 'nodemailer';

export async function newmailer(user, subject, message) {
  try {
    let transporter = createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        type: 'OAuth2',
        user: 'no-reply@finosell.com',
        serviceClient: '110418033644085187546',
        privateKey:
          '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDhND0PAHR/0V29\nLLkh+DrU2MYkS1pVuYqGmM5tzUS4niRtwwcnmeCpdtuVex3gCMY9nYGcIpRaYkuF\nMwLcfYOU9PR5U83oQD7ZNRnsYx9BiVQlRhLL+WNSC5Hb86NKlz9JRJu19/jBvtwN\nYrSRl+wqIIwtYDIropjhYJJEoTU8OFlpBtAO/j5s2utDnfMXLagTDxESsNa5PqsM\n/Ng1T5fo2QiymGAdI5CKgUoQCx7gAjYHk8fBtnLtvpjRv4S8MurK4gjrK24pVfiX\nwH0qbYnA7/Httdy2ctFtIBlurYLQfZV+iwQcT1cnnVcKCeDZhVPPhRV9NmWNqNcK\nnBqm4jj1AgMBAAECggEABryh0PeSBJrWQ4j5ds8ur1xWvRI1/xeAUdtzXWyFEELG\n0zPA3InpYxhnpDadI60PhRtXm7ybFIMZQEBQ5xioHYYgZBrCL57wYl4Iyv4CGttJ\nVZ4dhNWOh49KCzrkGSCiJ4ZyZASpf94+RfY8cZiKW45Csz7L8Ws5SJCzf3MVHRqC\nDptJdSeLzExImhBBQaCJ0wmBslXzscYuIpO9j9TjDnUcsFDE28itdpopsfUZCdpP\n1HvF5TLdTONkSEXe+AGjvhUNU/nD0Nie4AjHwaCXA4vX5+yuxXFJ6qDBUQP7RnFw\nfI7Lonv3BlALII7OZ8eFg/8zPAHn3X4ysiNGpsOwZwKBgQD4KnruNy/XZRVeSfl5\nxgDU11d46kqYfQIDu+igo083/nZK3JN7nRqbGeieGXS4LAAZzxt9CD3T8FAcWfCB\nq7Q9b7BqhUivn+2cnx6Y4ma81EHY6Q3Hfq0vcWOm9UKiUIZurMc9YRoASA1uEmRU\nGu3PXtCkWbZYWhcJBBPjxAh3EwKBgQDoUDHnqVHWG6yfiY8l08fk2gA7JBIldgjT\nWn81V1Abk+uibIRQnNKrwbwVyCDhdCy4a3KP713JhpRlqRUJN7g63/RCI+5knl+2\nT8YGLbwn/E2KdM/y/WU39tEmtAIuEta2Qr52dDnHIopNkLGiFT2TQjDJxlBXcuRf\nDgtHI0/o1wKBgHQpxlM9h+pmSaNSMzH6Kid3CV3zJanNUiUXT2PqLcnDFfIi3/JL\n7slNTmK6/bS7++wY0wAq3G4ZnhY3T2oTSpI7drPV4dk7nkji/rqHt5mKLaxwIuAP\n/tcnV4MuaNt7oAGsZLLpgfdBwu+UMlxgIpMgCb/0snMW8JNq0jiaaW/7AoGBAL44\nHATSMX4dPuWK3zlcBYsvrYy/ZlRiJ6vXp91nVuKd5g0iydyv7BhTE8zKB5JTa+K9\nqBqPJr5CgfQT1HOtuh4LDpexkBu3SiufekfI3w3mmx9JspQGRADlCjCkqDxNlJ28\nXPPlCwIxGAmW9rv+pGKVihlNVq+kFbZ3a2ieU2oVAoGBALFxQgN0hX3wE/cdnEFr\nL4wDn5rkn4F8llHiAF9OzwWYJyeCvTgNEM4lcJ5/BCf6l153gRfLZ5+qwzhECVrq\nyeAnm5Kd4Dg8YQc/JD0mPWwd38PG6BbG2o8mLRsdIq5+l55BvVG8KpURT139YZDw\nXcIDZj66iy62dAL6lwrGHeda\n-----END PRIVATE KEY-----\n',
        accessToken: 'ya29.Xx_XX0xxxxx-xX0X0XxXXxXxXXXxX0x',
        expires: 1484314697598,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    // send some mail
    transporter.sendMail(
      {
        from: {
          name: 'Deepcode',
          address: 'no-reply@deepcode.com',
        },
        to: user,
        subject: subject,
        html: message,
        tls: {
          rejectUnauthorised: false,
        },
        // ses: { // optional extra arguments for SendRawEmail
        //     Tags: [{
        //         Name: 'tag name',
        //         Value: 'tag value'
        //     }]
        // }
      },
      (err, info) => {
        if (err) {
          console.log('Error:', { err });
          return err;
        } else {
          console.log({ info });
          return info;
        }
        // console.log(info.envelope);
        // console.log(info.messageId);
      }
    );
  } catch (error) {
    console.log('Error here:', error);
    if (!error.statusCode) error.statusCode = 500;
    next(error);
  }
}
