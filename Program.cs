using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Windows.Forms;

namespace SangibuDesktopOffice
{
    static class Program
    {
        [STAThread]
        static void Main()
        {
            try
            {
                string appDir = AppDomain.CurrentDomain.BaseDirectory;
                string localHtml = Path.Combine(appDir, "index.html");
                if (!File.Exists(localHtml))
                {
                    localHtml = Path.Combine(appDir, "preview.html");
                }
                if (!File.Exists(localHtml))
                {
                    localHtml = Path.Combine(appDir, "통합_생기부도우미.html");
                }

                string onlineUrl = "https://neis-help-one.vercel.app/";
                string targetUrl = onlineUrl;

                // 1. 온라인 접속 가능 여부 빠른 확인 (인터넷이 안 되는 폐쇄망/오프라인 환경 자동 감지)
                bool isOnline = CheckOnline(onlineUrl);

                if (!isOnline && File.Exists(localHtml))
                {
                    // 오프라인 상태이고 로컬 파일이 있으면 로컬 파일로 실행
                    targetUrl = "file:///" + localHtml.Replace('\\', '/');
                }

                // 2. AI 구독 및 로그인 유지용 격리 프로필 폴더 설정
                string profileDir = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "SangibuOfficeProfile2"
                );

                if (!Directory.Exists(profileDir))
                {
                    Directory.CreateDirectory(profileDir);
                }

                // 3. 브라우저 엔진 탐색 (Edge 또는 Chrome)
                string browserExe = FindBrowser();

                if (!string.IsNullOrEmpty(browserExe))
                {
                    // 전용 앱 창 모드로 실행 (--app)
                    string args = string.Format(
                        "--app=\"{0}\" --user-data-dir=\"{1}\" --window-position=0,0 --window-size=1120,940",
                        targetUrl,
                        profileDir
                    );

                    ProcessStartInfo psi = new ProcessStartInfo();
                    psi.FileName = browserExe;
                    psi.Arguments = args;
                    psi.UseShellExecute = true;
                    Process.Start(psi);
                }
                else
                {
                    Process.Start(targetUrl);
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show(
                    "생기부 도우미 실행 중 오류가 발생했습니다:\n" + ex.Message,
                    "실행 오류",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
            }
        }

        static bool CheckOnline(string url)
        {
            try
            {
                HttpWebRequest req = (HttpWebRequest)WebRequest.Create(url);
                req.Timeout = 1500;
                req.Method = "HEAD";
                using (HttpWebResponse res = (HttpWebResponse)req.GetResponse())
                {
                    return res.StatusCode == HttpStatusCode.OK;
                }
            }
            catch
            {
                return false;
            }
        }

        static string FindBrowser()
        {
            string[] edgePaths = new string[]
            {
                @"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
                @"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"Microsoft\Edge\Application\msedge.exe"),
                @"C:\Program Files\Google\Chrome\Application\chrome.exe",
                @"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"Google\Chrome\Application\chrome.exe")
            };

            foreach (string p in edgePaths)
            {
                if (File.Exists(p)) return p;
            }
            return null;
        }
    }
}
