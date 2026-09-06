using System;
using System.Diagnostics;

internal static class NovaDevConsoleLauncher
{
    [STAThread]
    private static void Main()
    {
        var psi = new ProcessStartInfo
        {
            FileName = "wscript.exe",
            Arguments = "//Nologo \"F:\\Ai-pilotdeck\\NovaLauncher.vbs\"",
            UseShellExecute = false,
            CreateNoWindow = true,
            WindowStyle = ProcessWindowStyle.Hidden,
        };
        Process.Start(psi);
    }
}
