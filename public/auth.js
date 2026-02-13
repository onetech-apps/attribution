/**
 * Dashboard Auth Gate
 * Простий захист паролем для адмін-сторінок.
 * Пароль зберігається в localStorage після введення.
 * 
 * Щоб змінити пароль, змініть ADMIN_PASSWORD нижче.
 */
(function () {
    const ADMIN_PASSWORD = 'attr2024admin';
    const STORAGE_KEY = 'attribution_auth';
    const SESSION_HOURS = 24;

    // Перевірити чи вже залогінений
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        try {
            const data = JSON.parse(stored);
            const expires = new Date(data.expires);
            if (expires > new Date() && data.hash === btoa(ADMIN_PASSWORD)) {
                return; // Авторизований — не показувати overlay
            }
        } catch (e) { }
        localStorage.removeItem(STORAGE_KEY);
    }

    // Сховати весь контент сторінки
    document.documentElement.style.visibility = 'hidden';

    function showLoginOverlay() {
        document.body.style.visibility = 'hidden';

        const overlay = document.createElement('div');
        overlay.id = 'authOverlay';
        // visibility: visible перевизначає батьківський hidden
        overlay.style.cssText = 'visibility: visible; position: fixed; inset: 0; z-index: 99999;';
        overlay.innerHTML = `
            <div style="
                position: fixed; inset: 0; z-index: 99999;
                background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);
                display: flex; align-items: center; justify-content: center;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                visibility: visible;
            ">
                <div style="
                    background: rgba(30, 41, 59, 0.8);
                    border: 1px solid rgba(99, 102, 241, 0.3);
                    border-radius: 16px;
                    padding: 48px 40px;
                    width: 380px;
                    backdrop-filter: blur(20px);
                    box-shadow: 0 25px 50px rgba(0,0,0,0.5);
                    visibility: visible;
                ">
                    <div style="text-align: center; margin-bottom: 32px;">
                        <div style="
                            width: 64px; height: 64px; margin: 0 auto 16px;
                            background: linear-gradient(135deg, #6366f1, #8b5cf6);
                            border-radius: 16px; display: flex;
                            align-items: center; justify-content: center;
                            font-size: 28px;
                        ">🔒</div>
                        <h2 style="color: #f1f5f9; margin: 0 0 8px; font-size: 22px; font-weight: 600;">
                            Attribution System
                        </h2>
                        <p style="color: #94a3b8; margin: 0; font-size: 14px;">
                            Введіть пароль для доступу
                        </p>
                    </div>
                    <div style="margin-bottom: 24px;">
                        <input type="password" id="authPassword" placeholder="Пароль" style="
                            width: 100%; box-sizing: border-box;
                            padding: 14px 16px; border-radius: 10px;
                            border: 1px solid rgba(99, 102, 241, 0.3);
                            background: rgba(15, 23, 42, 0.6);
                            color: #f1f5f9; font-size: 15px;
                            outline: none; transition: border-color 0.2s;
                        " />
                    </div>
                    <div id="authError" style="
                        color: #ef4444; font-size: 13px; text-align: center;
                        margin-bottom: 16px; display: none;
                    ">Невірний пароль</div>
                    <button id="authSubmit" style="
                        width: 100%; padding: 14px; border: none; border-radius: 10px;
                        background: linear-gradient(135deg, #6366f1, #8b5cf6);
                        color: white; font-size: 15px; font-weight: 600;
                        cursor: pointer; transition: opacity 0.2s;
                    ">
                        Увійти
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        function tryLogin() {
            var pwd = document.getElementById('authPassword').value;
            if (pwd === ADMIN_PASSWORD) {
                var expires = new Date();
                expires.setHours(expires.getHours() + SESSION_HOURS);
                localStorage.setItem(STORAGE_KEY, JSON.stringify({
                    hash: btoa(ADMIN_PASSWORD),
                    expires: expires.toISOString()
                }));
                overlay.remove();
                document.documentElement.style.visibility = 'visible';
                document.body.style.visibility = 'visible';
            } else {
                document.getElementById('authError').style.display = 'block';
                document.getElementById('authPassword').value = '';
                document.getElementById('authPassword').focus();
            }
        }

        document.getElementById('authSubmit').addEventListener('click', tryLogin);
        document.getElementById('authPassword').addEventListener('keydown', function (e) {
            if (e.key === 'Enter') tryLogin();
        });

        setTimeout(function () { document.getElementById('authPassword').focus(); }, 200);
    }

    // Запустити після завантаження DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', showLoginOverlay);
    } else {
        showLoginOverlay();
    }
})();
