package ar.com.securia.red

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.wifi.SupplicantState
import android.net.wifi.WifiInfo
import android.net.wifi.WifiManager
import android.os.Build
import com.facebook.react.modules.network.OkHttpClientProvider
import okhttp3.Dispatcher
import okhttp3.Interceptor
import java.io.IOException
import java.util.concurrent.CopyOnWriteArraySet

object PoliticaRed {
  enum class Estado { PERMITIDA, PUBLICA, SIN_VERIFICAR }

  private lateinit var conectividad: ConnectivityManager
  private lateinit var wifi: WifiManager
  private val solicitudes = Dispatcher()
  private val observadores = CopyOnWriteArraySet<(Estado) -> Unit>()

  @JvmStatic
  fun instalar(context: Context) {
    conectividad = context.getSystemService(ConnectivityManager::class.java)
    wifi = context.applicationContext.getSystemService(WifiManager::class.java)
    val filtro = Interceptor { cadena ->
      val esquema = cadena.request().url.scheme
      val esRemota = esquema == "http" || esquema == "https"
      if (esRemota && estadoActual() != Estado.PERMITIDA) {
        throw IOException("SECURIA_WIFI_RESTRINGIDA")
      }
      cadena.proceed(cadena.request())
    }
    // Expo Fetch y el transporte de React Native obtienen su cliente de este proveedor.
    OkHttpClientProvider.setOkHttpClientFactory {
      OkHttpClientProvider.createClientBuilder()
        .dispatcher(solicitudes)
        .addInterceptor(filtro)
        .addNetworkInterceptor(filtro)
        .build()
    }
    conectividad.registerDefaultNetworkCallback(object : ConnectivityManager.NetworkCallback() {
      override fun onCapabilitiesChanged(network: Network, capabilities: NetworkCapabilities) {
        if (network == conectividad.activeNetwork) publicar(clasificar(capabilities))
      }

      override fun onLost(network: Network) {
        publicar(estadoActual())
      }
    })
  }

  fun estadoActual(): Estado = clasificar(conectividad.getNetworkCapabilities(conectividad.activeNetwork))

  fun observar(onCambio: (Estado) -> Unit) { observadores.add(onCambio) }

  fun dejarDeObservar(onCambio: (Estado) -> Unit) { observadores.remove(onCambio) }

  private fun publicar(estado: Estado) {
    if (estado != Estado.PERMITIDA) solicitudes.cancelAll()
    observadores.forEach { it(estado) }
  }

  @Suppress("DEPRECATION")
  private fun clasificar(red: NetworkCapabilities?): Estado {
    if (red == null) return Estado.PERMITIDA
    val esWifi = red.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)
    // Una VPN puede ocultar el transporte Wi-Fi subyacente.
    if (!esWifi && !red.hasTransport(NetworkCapabilities.TRANSPORT_VPN)) return Estado.PERMITIDA
    val transporte = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) red.transportInfo as? WifiInfo else null
    val conexion = transporte ?: run {
      wifi.connectionInfo?.takeIf { it.supplicantState == SupplicantState.COMPLETED }
    }
    if (!esWifi && conexion == null) return Estado.PERMITIDA
    if (red.hasCapability(NetworkCapabilities.NET_CAPABILITY_CAPTIVE_PORTAL)) return Estado.PUBLICA
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S || conexion == null) return Estado.SIN_VERIFICAR
    return when (conexion.currentSecurityType) {
      WifiInfo.SECURITY_TYPE_OPEN, WifiInfo.SECURITY_TYPE_WEP, WifiInfo.SECURITY_TYPE_OWE -> Estado.PUBLICA
      WifiInfo.SECURITY_TYPE_UNKNOWN -> Estado.SIN_VERIFICAR
      else -> Estado.PERMITIDA
    }
  }
}
