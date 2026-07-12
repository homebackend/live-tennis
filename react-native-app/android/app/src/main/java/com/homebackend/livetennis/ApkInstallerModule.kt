package com.homebackend.livetennis

import android.content.Intent
import android.net.Uri
import android.os.Build
import androidx.core.content.FileProvider
import com.facebook.react.bridge.*
import java.io.File

class ApkInstallerModule(reactContext: ReactApplicationContext) :
        ReactContextBaseJavaModule(reactContext) {
    override fun getName() = "ApkInstaller"

    @ReactMethod
    fun install(filePath: String, promise: Promise) {
        try {
            val activity = reactApplicationContext.currentActivity ?: throw Exception("No activity")
            val file = File(filePath)
            val uri: Uri =
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                        FileProvider.getUriForFile(
                                activity,
                                "${activity.packageName}.fileprovider",
                                file,
                        )
                    } else {
                        Uri.fromFile(file)
                    }

            val intent =
                    Intent(Intent.ACTION_VIEW).apply {
                        setDataAndType(uri, "application/vnd.android.package-archive")
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    }
            activity.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("INSTALL_FAILED", e.message)
        }
    }
}
