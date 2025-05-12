FROM node:20

# Де буде жити твій бот всередині контейнера
WORKDIR /app

# Копіюємо package.json i lock-файл
COPY package*.json ./

# Встановлюємо всі залежності
RUN npm install

# Копіюємо ВСЕ, окрім того, що в .dockerignore
COPY . .

# Вказуємо, що буде запускатися
CMD ["npm", "run", "start"]
