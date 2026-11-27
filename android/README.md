# Ashika Live TV for Android

This is a separate Android WebView wrapper for the Ashika Live TV web application.

- Android application ID: `com.ashika.livetv.android`
- Version: `1.0.0`
- Minimum Android: 6.0 (API 23)
- The webOS IPK build and webOS application metadata are not modified by this Android branch.
- The Android workflow copies the web player files into the APK assets at build time and uploads a debug APK artifact.
- Playlist URLs still depend on the playlist host allowing access from Android/WebView; stream availability is not guaranteed by the app itself.

Build locally from this directory with Android SDK and Gradle 8.9:
`gradle :app:assembleDebug`
