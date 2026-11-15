package ar.com.securia.red

import android.content.Intent
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class RedModule : Module() {
  private val cambio: (PoliticaRed.Estado) -> Unit = { sendEvent("cambioRed", mapOf("estado" to it.name)) }

  override fun definition() = ModuleDefinition {
    Name("SecuriaRed")
    Events("cambioRed")
    Function("estado") { PoliticaRed.estadoActual().name }
    OnStartObserving { PoliticaRed.observar(cambio) }
    OnStopObserving { PoliticaRed.dejarDeObservar(cambio) }
    OnDestroy { PoliticaRed.dejarDeObservar(cambio) }

    AsyncFunction("abrirAjustes") {
      val context = requireNotNull(appContext.reactContext)
      val accion = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        Settings.Panel.ACTION_INTERNET_CONNECTIVITY
      } else Settings.ACTION_WIFI_SETTINGS
      context.startActivity(Intent(accion).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
  }
}
