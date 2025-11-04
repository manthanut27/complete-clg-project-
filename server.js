// server.js
const express = require("express");
const fs = require("fs");
const path = require("path");
const bodyParser = require("body-parser");
const cors = require("cors");

const app = express();
const PORT = 3000;
const RESERVATION_FILE = path.join(__dirname, "reservations.json");
const TABLE_LIMIT = 25; // 25 tables per 1.5-hour slot
const RESET_INTERVAL_MS = 60 * 60 * 1000; // reset every 1 hour

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public"))); // ✅ Serve from /public

// Load & save reservations
function loadReservations() {
  if (!fs.existsSync(RESERVATION_FILE)) return [];
  return JSON.parse(fs.readFileSync(RESERVATION_FILE, "utf8"));
}
function saveReservations(data) {
  fs.writeFileSync(RESERVATION_FILE, JSON.stringify(data, null, 2));
}

// Reset reservations every hour
setInterval(() => {
  console.log("Resetting reservations...");
  saveReservations([]);
}, RESET_INTERVAL_MS);

// Convert HH:mm to 1.5-hour slot
function getTimeSlot(time) {
  const [hour, minute] = time.split(":").map(Number);
  const slotStart = hour + minute / 60;
  const slotIndex = Math.floor(slotStart / 1.5);
  const startHour = (slotIndex * 1.5) | 0;
  const endHour = startHour + 1;
  const endMinute = 30;
  const fmt = (h, m) =>
    `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  return `${fmt(startHour, 0)}-${fmt(endHour, endMinute)}`;
}

// Reservation endpoint
app.post("/reserve", (req, res) => {
  const { name, contact, date, time, guests, paymentMethod } = req.body;
  if (!name || !contact || !date || !time || !guests)
    return res.status(400).json({ message: "All fields are required." });

  if (paymentMethod !== "cash")
    return res.status(400).json({ message: "Only cash payment is accepted." });

  const reservations = loadReservations();
  const slot = getTimeSlot(time);

  const sameSlotReservations = reservations.filter(
    (r) => r.date === date && r.slot === slot
  );

  const duplicateBooking = sameSlotReservations.find(
    (r) =>
      r.contact === contact ||
      r.name.trim().toLowerCase() === name.trim().toLowerCase()
  );
  if (duplicateBooking) {
    return res
      .status(400)
      .json({ message: "You already have a reservation for this time slot." });
  }

  const userExistingReservation = reservations.find(
    (r) =>
      (r.contact === contact ||
        r.name.trim().toLowerCase() === name.trim().toLowerCase()) &&
      r.date === date
  );
  if (userExistingReservation) {
    return res.status(400).json({
      message:
        "You already have an active reservation today. Please wait until it resets before booking another.",
    });
  }

  if (sameSlotReservations.length >= TABLE_LIMIT) {
    return res.status(400).json({
      message: `Sorry, all ${TABLE_LIMIT} tables are booked for the ${slot} slot.`,
    });
  }

  const newReservation = {
    id: Date.now(),
    name,
    contact,
    date,
    time,
    slot,
    guests,
    paymentMethod,
  };
  reservations.push(newReservation);
  saveReservations(reservations);

  res.status(200).json({
    message: `Reservation confirmed for ${slot}. Please arrive on time.`,
  });
});

// Admin route
app.get("/admin/reservations", (req, res) => {
  const reservations = loadReservations();
  res.json(reservations);
});

app.listen(PORT, () =>
  console.log(`✅ Server running on http://localhost:${PORT}`)
);
