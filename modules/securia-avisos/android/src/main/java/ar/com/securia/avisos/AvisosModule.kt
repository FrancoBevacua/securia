package ar.com.securia.avisos

import android.app.AlarmManager
import android.app.NotificationManager
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class AvisosModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SecuriaAvisos")

    AsyncFunction("puedeProgramarExactas") {
      val context = requireNotNull(appContext.reactContext)
      Build.VERSION.SDK_INT < Build.VERSION_CODES.S ||
        context.getSystemService(AlarmManager::class.java).canScheduleExactAlarms()
    }

    AsyncFunction("canalHabilitado") { canal: String ->
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
        true
      } else {
        val context = requireNotNull(appContext.reactContext)
        val manager = context.getSystemService(NotificationManager::class.java)
        val channel = manager.getNotificationChannel(canal)
        channel != null && channel.importance != NotificationManager.IMPORTANCE_NONE
      }
    }

    AsyncFunction("abrirAjustesAvisos") { exactas: Boolean, canal: String ->
      val context = requireNotNull(appContext.reactContext)
      val aplicacion = Uri.fromParts("package", context.packageName, null)
      val intent = when {
        exactas && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ->
          Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, aplicacion)
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.O ->
          Intent(Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS)
          .putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
          .putExtra(Settings.EXTRA_CHANNEL_ID, canal)
        else -> Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, aplicacion)
      }
      context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
  }
}
