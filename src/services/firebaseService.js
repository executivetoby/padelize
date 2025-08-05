import admin from 'firebase-admin';
import { validationResult } from 'express-validator';
import FirebaseToken from '../models/FirebaseToken.js';
import AppError from '../utils/appError.js';

class FirebaseService {
  static instance = null;

  constructor() {
    if (FirebaseService.instance) {
      return FirebaseService.instance;
    }

    this.initializeFirebase();
    FirebaseService.instance = this;
  }

  initializeFirebase() {
    try {
      if (!admin.apps.length) {
        const serviceAccount = {
          type: 'service_account',
          project_id: 'studocs',
          private_key_id: '908be803c0d0dd07417231ae168440a73b4d896f',
          private_key: `-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDHwPUvodq7gHVu\nX0vYANAVlWmFvuobF6rgi3UOaHJFE3Uy89XW8VoilNaqKrne+cdV/t7htZxAhUO8\n0h16C8TgjCv6Dl82EzPdU53MpXXcsjm+Lmgc1rG+YgfZ+jGu12l3+nT82ELqpeuX\nuJV6l7+DvoNx4pteQHjo/sHyvcHg7rtJB3kgTAI1RGeTGH8ji6D8vtn7O+fs1MTm\n0ZeLJAKCWbKB7hwgYasWETc76E5ckcVhbQO+ovup7sCfv87NlMipcb1KSMWzGIWl\nSPm7oxMdBSfWi25VbMd/9IYW1eyprh0KuuadeKFEnyjpBtGZVsCRD3bjUB/Tqqjl\nw+HNYeGhAgMBAAECggEAFfcPXwX+veiBwTnEZsOsHft4h4b3SjRfi2J6ZDOzAQqD\nNC+g34pZnXzdYAfjuXOg6kFk88/bFzMwQCagrCd4JjLzsQL8kD8rUFad/v9gxvxo\nIhQLScSH9gXklCERbobsZ4+IZrdHIHNPRTc8ZKckHZII9TB0YjhXs1M0M4OPOrMD\n9JISr8owv1H/uJwk58jJIPy10T4pXLzKgcd6LICEr2muOaeaT9m38BUJIrKPXh0I\nGD/C/iVCzFwpQakhVNiYYNHUER8ZmBbFUz1Yq2bn6YhtjpU6Vl1cnQBN54SXXH53\nd40Fh9X0NN3emIyY5nhwm1VvNXsqjtauZmBPxq2T2wKBgQDiFZaklSX/uFJvk1jG\nLbLdnukoHJiX0vOQTcx7TYv7U9CWZ55exH/b5ONjKM8dnXpreVhYrysy+xuPlTeD\nTpcipzD71UlgfgI9kvar7NlYLkqP3kqwbzOLBbsSJXq9hS0UVKqrOzZ0v0VsdMWO\n8SLY6VyqkzYYx20FZPrtj5WD5wKBgQDiL3F+/XeovNNPfU+78mToCOvr88ZxH66u\nsIBlb/6vLL8VMwYwgoxdeILYnQLqNVo8CgLBeqIctZyES/h/AYZDimzF+GShLpva\nVtKMBLE1NOAsngx0PPJ026sUAAuZGyrfifGSgp71sl+0lquaCttuUJxzypdRRiK0\nEp5/gve9NwKBgAbzgPk4eL2fDjHOBvm45/n2a9bG4k4wtzplmfbkkHw+vHgTYYQq\naH/7Tp5637taXyw0w+meISblH5jPjrBj1zPCjjf/+8ySs0DvZtQsaRZT/gjkXcmE\n8cHBgFnzew2erZ8lZ0XygR8fzmOiR3y4n0iqDCZWdmBWqVx0GV76fi9bAoGBAIqP\nreOxuyAvrPPBPJtSvuY2sPB3AlZCpmx1y/JYTZlavCRsgZouH3cTYHT6mtKHpKOr\nLk0Ap1cXGq8hKzYC5RFzN3d/14W2W9vB3HHSXgzOO5aZq995hr5347H45SICNp2C\nj+7E/kRd5atnsfBIPmyyDWYR8ejkIlZWIarTvJi5AoGAYsZiQR5p/uZ2EwsOaByk\nk17XQrkx86g4z7L+CFbda8z1tvYsW9nNI/rrqFuHFU38wN37FOIRRRX5v30hOk82\n4McTSO8dOmPSvqB16+mg8nqp5tlr4cBsjWlh9tE51rOfZM9VzSbtMvq4wNb+iuQ7\n9N2JVjCWrEji0CcTvXbFohg=\n-----END PRIVATE KEY-----\n`,
          client_email:
            'firebase-adminsdk-q2o5q@studocs.iam.gserviceaccount.com',
          client_id: '104529953782002694070',
          auth_uri: 'https://accounts.google.com/o/oauth2/auth',
          token_uri: 'https://oauth2.googleapis.com/token',
          auth_provider_x509_cert_url:
            'https://www.googleapis.com/oauth2/v1/certs',
          client_x509_cert_url:
            'https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-q2o5q%40studocs.iam.gserviceaccount.com',
          universe_domain: 'googleapis.com',
        };

        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });

        console.log('Firebase Admin initialized successfully');
      }
    } catch (error) {
      console.error('Error initializing Firebase Admin:', error);
      throw error;
    }
  }

  // Fixed send method for programmatic use
  static async sendNotification(userId, title, message, additionalData = {}) {
    // Ensure Firebase is initialized
    new FirebaseService();

    try {
      // Get user's FCM token
      const tokenDoc = await FirebaseToken.findOne({ user: userId });
      if (!tokenDoc || !tokenDoc.regid) {
        console.log(`No FCM token found for user: ${userId}`);
        return { success: false, message: 'No FCM token found' };
      }

      // Prepare notification payload
      const messagePayload = {
        notification: {
          title,
          body: message,
        },
        data: {
          message,
          click_action: 'FLUTTER_NOTIFICATION_CLICK',
          ...additionalData, // Allow additional data to be passed
        },
        android: {
          notification: {
            icon: 'ic_notification',
            color: '#FF6B6B',
            sound: 'default',
          },
        },
        apns: {
          payload: {
            aps: {
              alert: {
                title,
                body: message,
              },
              badge: 1,
              sound: 'default',
            },
          },
        },
        token: tokenDoc.regid,
      };

      // Send message
      const response = await admin.messaging().send(messagePayload);
      console.log('Notification sent successfully:', response);

      return { success: true, messageId: response };
    } catch (error) {
      console.error('Error sending notification:', error);
      return { success: false, error: error.message };
    }
  }

  // Express route handler (existing functionality)
  static async send(req, res, next) {
    // Ensure Firebase is initialized before sending
    new FirebaseService();

    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(new AppError(errors.array(), 422));
      }

      const { message, title, user } = req.body;

      const result = await this.sendNotification(user, title, message);

      if (result.success) {
        return res.status(200).json({
          status: 'success',
          messageId: result.messageId,
          message: 'Notification sent successfully',
        });
      } else {
        return next(new AppError(result.message || result.error, 404));
      }
    } catch (error) {
      console.error('Error in send method:', error);
      return next(new AppError('Failed to send notification', 500));
    }
  }

  // Send to multiple users
  static async sendMultiple(req, res) {
    // Ensure Firebase is initialized before sending
    new FirebaseService();

    try {
      const { message, title, users } = req.body;

      // Get tokens for all users
      const tokenDocs = await FirebaseToken.find({
        user: { $in: users },
      });

      const tokens = tokenDocs.map((doc) => doc.regid).filter(Boolean);

      if (!tokens.length) {
        return res.status(404).json({
          success: false,
          message: 'No valid FCM tokens found',
        });
      }

      // Prepare notification payload
      const messagePayload = {
        notification: {
          title,
          body: message,
        },
        data: {
          message,
          click_action: 'FLUTTER_NOTIFICATION_CLICK',
        },
        android: {
          notification: {
            icon: 'ic_notification',
            color: '#FF6B6B',
            sound: 'default',
          },
        },
        apns: {
          payload: {
            aps: {
              alert: { title, body: message },
              badge: 1,
              sound: 'default',
            },
          },
        },
        tokens,
      };

      // Send message
      const response = await admin.messaging().sendMulticast(messagePayload);

      return res.status(200).json({
        success: true,
        successCount: response.successCount,
        failureCount: response.failureCount,
        message: 'Notifications sent',
      });
    } catch (error) {
      console.error('Error sending notifications:', error);
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  // Utility method to send multiple notifications programmatically
  static async sendMultipleNotifications(
    userIds,
    title,
    message,
    additionalData = {}
  ) {
    new FirebaseService();

    try {
      const tokenDocs = await FirebaseToken.find({
        user: { $in: userIds },
      });

      const tokens = tokenDocs.map((doc) => doc.regid).filter(Boolean);

      if (!tokens.length) {
        return { success: false, message: 'No valid FCM tokens found' };
      }

      const messagePayload = {
        notification: { title, body: message },
        data: {
          message,
          click_action: 'FLUTTER_NOTIFICATION_CLICK',
          ...additionalData,
        },
        android: {
          notification: {
            icon: 'ic_notification',
            color: '#FF6B6B',
            sound: 'default',
          },
        },
        apns: {
          payload: {
            aps: {
              alert: { title, body: message },
              badge: 1,
              sound: 'default',
            },
          },
        },
        tokens,
      };

      const response = await admin.messaging().sendMulticast(messagePayload);

      return {
        success: true,
        successCount: response.successCount,
        failureCount: response.failureCount,
      };
    } catch (error) {
      console.error('Error sending multiple notifications:', error);
      return { success: false, error: error.message };
    }
  }
}

export default FirebaseService;
