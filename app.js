const bodyParser = require('body-parser');
const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv/config');
const authJwt = require('./middlewares/jwt');
const errorHandler = require('./middlewares/error_handler');

const app = express();
const env = process.env;
const API = env.API_URL;

app.use(bodyParser.json());
app.use(morgan('tiny'));
app.use(cors());
app.options(/.*/, cors());
app.use(authJwt());
app.use(errorHandler);

const authRouter = require('./routes/auth');
const usersRouter = require('./routes/users');
const adminRouter = require('./routes/admin');
const categoriesRouter = require('./routes/categories');
const productsRouter = require('./routes/products');

app.use(`${API}/`, authRouter);
app.use(`${API}/users`, usersRouter);
app.use(`${API}/admin`, adminRouter);
app.use(`${API}/categories`, categoriesRouter);
app.use(`${API}/products`, productsRouter);
app.use(`/public`, express.static(`${__dirname}/public`));

require('./helpers/cron_job');

const host = env.HOST;
const port = env.PORT;

// Connect to MongoDB
mongoose
    .connect(env.MONGODB_CONNECTION_STRING)
    .then(async () => {
        console.log('Connected to MongoDB');
    })
    .catch((e) => {
        console.error(e);
    });

app.listen(port, host, () => {
    console.log(`Server running at http://${host}:${port}`);
});