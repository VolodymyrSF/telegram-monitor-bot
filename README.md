

## 📜 README.md
---

### 🚀 Що цей бот вміє?

Це бот, який:

* Моніторить чати в Telegram
* Шукає ключові слова
* Надсилає сповіщення на пошту
* Відновлює з’єднання, якщо Telegram вирішив піти попити кави
* Сповіщає тебе на пошту, якщо все пішло **в сраку**

---

## 🧾 `.env` — Підготовка

```
TELEGRAM_API_ID=1234567
TELEGRAM_API_HASH=abcdef1234567890abcdef1234567890
TELEGRAM_PHONE=+380XXXXXXXXX

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_EMAIL=your.email@gmail.com
SMTP_PASSWORD=тут_шифроване_значення
```

---

## 🔐 Як зашифрувати SMTP пароль?

в проекті є файлик encrypt-pass.js в якому є вивід значення в консоль
```js
console.log(encrypt('your-app-password-16digit'))
```

Виведе щось типу:
`b8f3cfd9a398c654f3c04e2f01972e0d`
Це і є те, що кладеш у `.env` в `SMTP_PASSWORD`.

---

## 🦾 Запуск

```bash
npm install
npm run start or node index.js
```

---

## 💬 Команди в CLI

```
/addchat <id | @username>      — додати чат до моніторингу
/removechat <id | @username>   — прибрати чат
/listchats                     — подивитись які чати моніторяться

/addword <слово>               — додати ключове слово
/removeword <слово>            — прибрати слово
/listwords                     — список слів

/stats                         — подивитись скільки повідомлень і збігів
/help                          — список команд
```

---

## 💥 Фейли і авто-реконект

* Якщо клієнт від’єднався від Telegram → **спробує під’єднатись знову**
* Якщо не вийшло → **прийде email**
* Якщо є будь-яка інша критична помилка → **прийде email**
* Все логується в консолі

---


