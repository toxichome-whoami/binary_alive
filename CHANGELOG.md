# Changelog

## Version 1.0.1 Updates
- **In-App Process Management**: Add, edit, delete, and group processes directly from the user interface.
- **Session Validation**: Changing a user's role or deleting an account instantly updates their active session.
- **Form Resubmission Fixes**: Uses the Post-Redirect-Get pattern to prevent browser "Confirm Form Resubmission" warnings on the Login, User Management, and Settings pages.
- **Database Settings**: Security settings (such as the CAPTCHA toggle) are now stored in the SQLite database to avoid file permission issues.
- **Admin Overrides**: Administrators can remove a user's 2FA setup if the user loses access to their authenticator app.
- **Rate Limiting**: The dashboard Refresh button has a 2-second delay to prevent excessive server requests.
- **Background Optimization**: Dashboard polling pauses when the browser tab is hidden to reduce server load.
- **UI Optimizations**: Buttons and checkboxes are hidden for restricted roles (Viewers/Auditors) for a cleaner interface.
- **Delete Functionality**: Added a dedicated API endpoint and a dashboard UI button to safely stop and permanently delete monitored processes.
