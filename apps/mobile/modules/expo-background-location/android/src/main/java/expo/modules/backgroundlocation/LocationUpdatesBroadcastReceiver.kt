package expo.modules.backgroundlocation

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import com.google.android.gms.location.LocationResult

/**
 * BroadcastReceiver for PendingIntent-based location updates.
 * 
 * Samsung Android 11+ throttles LocationCallback-based updates but honors
 * PendingIntent-based updates. This receiver extracts location updates from
 * the intent and forwards them to LocationForegroundService for processing.
 */
class LocationUpdatesBroadcastReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        Log.d(TAG, "Received location update broadcast")
        
        // Extract location result from the intent
        val locationResult = LocationResult.extractResult(intent)
        if (locationResult == null) {
            Log.w(TAG, "No location result in intent")
            return
        }

        val location = locationResult.lastLocation
        if (location == null) {
            Log.w(TAG, "No location in result")
            return
        }

        Log.d(TAG, "Forwarding location to service: lat=${location.latitude}, lng=${location.longitude}")

        // Forward location to the foreground service for processing
        val serviceIntent = Intent(context, LocationForegroundService::class.java).apply {
            action = LocationForegroundService.ACTION_PROCESS_LOCATION
            putExtra(EXTRA_LATITUDE, location.latitude)
            putExtra(EXTRA_LONGITUDE, location.longitude)
            putExtra(EXTRA_ACCURACY, if (location.hasAccuracy()) location.accuracy else -1f)
            putExtra(EXTRA_ALTITUDE, if (location.hasAltitude()) location.altitude else Double.NaN)
            putExtra(EXTRA_SPEED, if (location.hasSpeed()) location.speed else -1f)
            putExtra(EXTRA_BEARING, if (location.hasBearing()) location.bearing else -1f)
            putExtra(EXTRA_TIME, location.time)
        }

        // Start the service to process the location
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(serviceIntent)
        } else {
            context.startService(serviceIntent)
        }
    }

    companion object {
        private const val TAG = "LocationUpdatesBR"
        
        const val EXTRA_LATITUDE = "latitude"
        const val EXTRA_LONGITUDE = "longitude"
        const val EXTRA_ACCURACY = "accuracy"
        const val EXTRA_ALTITUDE = "altitude"
        const val EXTRA_SPEED = "speed"
        const val EXTRA_BEARING = "bearing"
        const val EXTRA_TIME = "time"
    }
}
