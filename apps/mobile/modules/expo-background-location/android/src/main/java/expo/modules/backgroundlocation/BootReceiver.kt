package expo.modules.backgroundlocation

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * BroadcastReceiver that restarts the location tracking service after device reboot.
 * This ensures location tracking continues after the phone restarts.
 */
class BootReceiver : BroadcastReceiver() {
    
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED ||
            intent.action == Intent.ACTION_MY_PACKAGE_REPLACED ||
            intent.action == "android.intent.action.QUICKBOOT_POWERON") {
            
            Log.d(TAG, "Boot/update received, checking if service should restart")
            
            // Check if tracking was enabled before reboot/update
            if (LocationForegroundService.shouldBeRunning(context)) {
                val userId = LocationForegroundService.getStoredUserId(context)
                val interval = LocationForegroundService.getStoredInterval(context)
                
                if (!userId.isNullOrBlank()) {
                    Log.d(TAG, "Restarting location service for user=$userId")
                    LocationForegroundService.start(context, userId, interval)
                } else {
                    Log.w(TAG, "No user ID stored, cannot restart service")
                }
            } else {
                Log.d(TAG, "Service was not running before, not restarting")
            }
        }
    }

    companion object {
        private const val TAG = "BootReceiver"
    }
}
