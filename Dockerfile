FROM node:18

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Create the data directory since the server throws errors otherwise if permissions block it
RUN mkdir -p /app/data && chmod 777 /app/data

# HF Spaces requires the app to listen on 7860
EXPOSE 7860

# We replace the PORT var with 7860 via ENV for HF
ENV PORT=7860

CMD ["npm", "run", "start"]
