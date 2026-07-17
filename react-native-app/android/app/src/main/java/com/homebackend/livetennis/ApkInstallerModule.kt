package com.homebackend.livetennis

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class ApkInstallerModule(private val reactContext: ReactApplicationContext) :
        ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "ApkInstaller"

    @ReactMethod
    fun getExternalCacheDir(promise: Promise) {
        promise.resolve(reactContext.externalCacheDir?.absolutePath)
    }

    @ReactMethod
    fun installApk(filePath: String, promise: Promise) {
        val activity = reactContext.getCurrentActivity()
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "No current Activity")
            return
        }

        val file = java.io.File(filePath)
        if (!file.exists()) {
            promise.reject("FILE_ERROR", "File not found: $filePath")
            return
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            if (!reactContext.packageManager.canRequestPackageInstalls()) {
                val intent =
                        Intent(
                                Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                                Uri.parse("package:${reactContext.packageName}")
                        )
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                reactContext.startActivity(intent)
                promise.reject("NEED_PERMISSION", "Allow from this source then retry")
                return
            }
        }

        try {
            val apkUri =
                    FileProvider.getUriForFile(
                            reactContext,
                            "${reactContext.packageName}.fileprovider",
                            file
                    )
            val intent =
                    Intent(Intent.ACTION_VIEW).apply {
                        setDataAndType(apkUri, "application/vnd.android.package-archive")
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    }
            activity.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("INSTALL_ERROR", e.message, e)
        }
    }
}
