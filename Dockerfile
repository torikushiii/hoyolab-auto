FROM node:20-alpine

WORKDIR /app

COPY ["package.json", "./"]
RUN npm i

COPY ["./", "./"]

USER node:node
CMD ["npm", "start"]
