# Use the exact Node version Render was using
FROM node:22.22.0-alpine

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package files first (to cache npm install)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of your backend code
COPY . .

# Build the project (This creates the 'dist' folder)
RUN npm run build

# Expose the port your NestJS app runs on
EXPOSE 3001

# The command to start your app
CMD ["npm", "run", "start:prod"]