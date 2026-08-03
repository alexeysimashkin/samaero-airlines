const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Инициализация базы
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS flights (
        id SERIAL PRIMARY KEY,
        flight_number VARCHAR(10) NOT NULL,
        origin VARCHAR(50) NOT NULL,
        origin_code VARCHAR(10) NOT NULL,
        destination VARCHAR(50) NOT NULL,
        destination_code VARCHAR(10) NOT NULL,
        departure_time TIMESTAMP NOT NULL,
        arrival_time TIMESTAMP NOT NULL,
        flight_duration VARCHAR(20) NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        days_of_week TEXT[] NOT NULL,
        price_min DECIMAL(10,2) NOT NULL,
        price_medium DECIMAL(10,2) NOT NULL,
        price_max DECIMAL(10,2) NOT NULL
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS bookings (
        id SERIAL PRIMARY KEY,
        booking_code VARCHAR(10) UNIQUE NOT NULL,
        flight_id INTEGER REFERENCES flights(id),
        tariff VARCHAR(20) NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        passenger_lastname VARCHAR(50) NOT NULL,
        passenger_firstname VARCHAR(50) NOT NULL,
        passenger_middlename VARCHAR(50),
        passenger_birthdate DATE NOT NULL,
        passenger_gender VARCHAR(10) NOT NULL,
        contact_phone VARCHAR(20) NOT NULL,
        contact_email VARCHAR(100) NOT NULL,
        booking_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('Database initialized');
  } catch (err) {
    console.error('DB init error:', err);
  }
}
initDB();

// Генерация кода бронирования
function generateBookingCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const digits = '0123456789';
  let code = '';
  for (let i = 0; i < 3; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  for (let i = 0; i < 3; i++) {
    code += digits[Math.floor(Math.random() * digits.length)];
  }
  return code.split('').sort(() => Math.random() - 0.5).join('');
}

// API: Получить все рейсы
app.get('/api/flights', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM flights ORDER BY departure_time');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Поиск рейсов
app.get('/api/flights/search', async (req, res) => {
  const { origin, destination, date, passengers } = req.query;
  try {
    let query = 'SELECT * FROM flights WHERE 1=1';
    const params = [];
    let paramIndex = 1;
    
    if (origin) {
      params.push(`%${origin}%`);
      query += ` AND (origin ILIKE $${paramIndex} OR origin_code ILIKE $${paramIndex})`;
      paramIndex++;
    }
    
    if (destination) {
      params.push(`%${destination}%`);
      query += ` AND (destination ILIKE $${paramIndex} OR destination_code ILIKE $${paramIndex})`;
      paramIndex++;
    }
    
    if (date) {
      params.push(date);
      query += ` AND DATE(departure_time) = $${paramIndex}`;
      paramIndex++;
    }
    
    query += ' ORDER BY departure_time';
    
    console.log('SQL Query:', query);
    console.log('Params:', params);
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: err.message });
  }
});

// API: Добавить рейс
app.post('/api/flights', async (req, res) => {
  const {
    flight_number, origin, origin_code, destination, destination_code,
    departure_time, arrival_time, flight_duration,
    start_date, end_date, days_of_week,
    price_min, price_medium, price_max
  } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO flights 
       (flight_number, origin, origin_code, destination, destination_code,
        departure_time, arrival_time, flight_duration,
        start_date, end_date, days_of_week,
        price_min, price_medium, price_max)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [flight_number, origin, origin_code, destination, destination_code,
       departure_time, arrival_time, flight_duration,
       start_date, end_date, days_of_week,
       price_min, price_medium, price_max]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Создать бронирование
app.post('/api/bookings', async (req, res) => {
  const {
    flight_id, tariff, price,
    passenger_lastname, passenger_firstname, passenger_middlename,
    passenger_birthdate, passenger_gender,
    contact_phone, contact_email
  } = req.body;

  const bookingCode = generateBookingCode();

  try {
    const result = await pool.query(
      `INSERT INTO bookings 
       (booking_code, flight_id, tariff, price,
        passenger_lastname, passenger_firstname, passenger_middlename,
        passenger_birthdate, passenger_gender,
        contact_phone, contact_email)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [bookingCode, flight_id, tariff, price,
       passenger_lastname, passenger_firstname, passenger_middlename,
       passenger_birthdate, passenger_gender,
       contact_phone, contact_email]
    );
    res.json({ 
      success: true, 
      bookingCode: bookingCode,
      booking: result.rows[0] 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Получить бронирование по коду
app.get('/api/bookings/:code', async (req, res) => {
  const { code } = req.params;
  try {
    const result = await pool.query(
      `SELECT b.*, f.* FROM bookings b 
       JOIN flights f ON b.flight_id = f.id 
       WHERE b.booking_code = $1`,
      [code]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`SamAero server running on port ${port}`);
});
