let selectedFlight = null;

// Переключение секций
function showSearch() {
    setActiveTab('searchSection');
}

function showBooking() {
    setActiveTab('bookingSection');
}

function showAdmin() {
    setActiveTab('adminSection');
}

function setActiveTab(id) {
    document.querySelectorAll('section').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
    if (id === 'searchSection') document.querySelector('nav button:nth-child(1)').classList.add('active');
    else if (id === 'bookingSection') document.querySelector('nav button:nth-child(2)').classList.add('active');
    else if (id === 'adminSection') document.querySelector('nav button:nth-child(3)').classList.add('active');
}

// Поиск рейсов
async function searchFlights() {
    const origin = document.getElementById('origin').value.trim();
    const destination = document.getElementById('destination').value.trim();
    const date = document.getElementById('flightDate').value;
    const passengers = document.getElementById('passengers').value;

    if (!origin || !destination || !date) {
        alert('Пожалуйста, заполните все поля поиска');
        return;
    }

    try {
        const params = new URLSearchParams({ origin, destination, date, passengers });
        const response = await fetch(`/api/flights/search?${params}`);
        const flights = await response.json();

        const resultsDiv = document.getElementById('searchResults');
        if (flights.length === 0) {
            resultsDiv.innerHTML = '<p style="text-align:center;color:#888;">Рейсов не найдено</p>';
            return;
        }

        resultsDiv.innerHTML = flights.map(flight => `
            <div class="flight-card">
                <div class="route">
                    ${flight.origin} (${flight.origin_code}) 
                    <span>→</span> 
                    ${flight.destination} (${flight.destination_code})
                </div>
                <div class="details">
                    <span>🛫 ${new Date(flight.departure_time).toLocaleString()}</span>
                    <span>🛬 ${new Date(flight.arrival_time).toLocaleString()}</span>
                    <span>⏱ ${flight.flight_duration}</span>
                    <span>✈ ${flight.flight_number}</span>
                </div>
                <div class="prices">
                    <span class="price-tag">Минимальный: ${flight.price_min}₽</span>
                    <span class="price-tag">Увеличенный: ${flight.price_medium}₽</span>
                    <span class="price-tag">Максимум: ${flight.price_max}₽</span>
                </div>
                <button class="btn-book" onclick="openBooking(${flight.id})">Выбрать</button>
            </div>
        `).join('');
    } catch (error) {
        alert('Ошибка при поиске рейсов');
        console.error(error);
    }
}

// Открыть бронирование
function openBooking(flightId) {
    fetch(`/api/flights`)
        .then(res => res.json())
        .then(flights => {
            selectedFlight = flights.find(f => f.id === flightId);
            if (!selectedFlight) return;

            const modal = document.getElementById('bookingModal');
            modal.style.display = 'block';

            document.getElementById('bookingModalContent').innerHTML = `
                <h3>${selectedFlight.origin} → ${selectedFlight.destination}</h3>
                <p><strong>Рейс:</strong> ${selectedFlight.flight_number}</p>
                <p><strong>Вылет:</strong> ${new Date(selectedFlight.departure_time).toLocaleString()}</p>
                <p><strong>Прилет:</strong> ${new Date(selectedFlight.arrival_time).toLocaleString()}</p>
                
                <div class="form-group">
                    <label>Выберите тариф</label>
                    <select id="tariffSelect">
                        <option value="minimal">Минимальный - ${selectedFlight.price_min}₽</option>
                        <option value="medium">Увеличенный - ${selectedFlight.price_medium}₽</option>
                        <option value="max">Максимум - ${selectedFlight.price_max}₽</option>
                    </select>
                </div>

                <h4 style="margin-top:1.5rem;">Данные пассажира</h4>
                <div class="form-row">
                    <div class="form-group">
                        <label>Фамилия *</label>
                        <input type="text" id="pLastName" required />
                    </div>
                    <div class="form-group">
                        <label>Имя *</label>
                        <input type="text" id="pFirstName" required />
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Отчество</label>
                        <input type="text" id="pMiddleName" />
                    </div>
                    <div class="form-group">
                        <label>Дата рождения *</label>
                        <input type="date" id="pBirthDate" required />
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Пол *</label>
                        <select id="pGender" required>
                            <option value="M">Мужской</option>
                            <option value="F">Женский</option>
                        </select>
                    </div>
                </div>

                <h4 style="margin-top:1.5rem;">Контакты</h4>
                <div class="form-row">
                    <div class="form-group">
                        <label>Телефон *</label>
                        <input type="tel" id="pPhone" placeholder="+7 (999) 123-45-67" required />
                    </div>
                    <div class="form-group">
                        <label>Email *</label>
                        <input type="email" id="pEmail" placeholder="example@mail.com" required />
                    </div>
                </div>

                <button class="btn-primary" onclick="processPayment()" style="width:100%;margin-top:1.5rem;">
                    Оплатить
                </button>
            `;
        });
}

// Процесс оплаты
async function processPayment() {
    const tariffSelect = document.getElementById('tariffSelect');
    const tariff = tariffSelect.value;
    let price;
    if (tariff === 'minimal') price = selectedFlight.price_min;
    else if (tariff === 'medium') price = selectedFlight.price_medium;
    else price = selectedFlight.price_max;

    const passengerData = {
        flight_id: selectedFlight.id,
        tariff: tariff,
        price: price,
        passenger_lastname: document.getElementById('pLastName').value.trim(),
        passenger_firstname: document.getElementById('pFirstName').value.trim(),
        passenger_middlename: document.getElementById('pMiddleName').value.trim() || null,
        passenger_birthdate: document.getElementById('pBirthDate').value,
        passenger_gender: document.getElementById('pGender').value,
        contact_phone: document.getElementById('pPhone').value.trim(),
        contact_email: document.getElementById('pEmail').value.trim()
    };

    // Проверка заполнения
    if (!passengerData.passenger_lastname || !passengerData.passenger_firstname || 
        !passengerData.passenger_birthdate || !passengerData.contact_phone || 
        !passengerData.contact_email) {
        alert('Пожалуйста, заполните все обязательные поля');
        return;
    }

    // Имитация загрузки
    const modalContent = document.getElementById('bookingModalContent');
    modalContent.innerHTML = '<div style="text-align:center;padding:2rem;"><h3>⏳ Обработка платежа...</h3></div>';

    try {
        const response = await fetch('/api/bookings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(passengerData)
        });

        const result = await response.json();

        if (result.success) {
            modalContent.innerHTML = `
                <div class="success-message">
                    <h2>✅ Ваш заказ успешно оформлен!</h2>
                    <p style="font-size:1.1rem;margin:1rem 0;">Код бронирования:</p>
                    <div class="booking-code">${result.bookingCode}</div>
                    <p style="color:#555;margin-top:1rem;">
                        Сохраните этот код для просмотра заказа
                    </p>
                    <button class="btn-primary" onclick="closeBookingModal()" style="margin-top:1rem;">
                        Закрыть
                    </button>
                </div>
            `;
        } else {
            alert('Ошибка при оформлении заказа');
            closeBookingModal();
        }
    } catch (error) {
        alert('Ошибка при оформлении заказа');
        console.error(error);
        closeBookingModal();
    }
}

// Получить бронирование по коду
async function getBooking() {
    const code = document.getElementById('bookingCode').value.trim().toUpperCase();
    if (!code) {
        alert('Введите код бронирования');
        return;
    }

    try {
        const response = await fetch(`/api/bookings/${code}`);
        if (!response.ok) {
            document.getElementById('bookingDetails').innerHTML = 
                '<p style="color:red;">Заказ с таким кодом не найден</p>';
            return;
        }

        const booking = await response.json();
        document.getElementById('bookingDetails').innerHTML = `
            <div class="flight-card">
                <h3>✈ Заказ #${booking.booking_code}</h3>
                <p><strong>Рейс:</strong> ${booking.flight_number}</p>
                <p><strong>Маршрут:</strong> ${booking.origin} → ${booking.destination}</p>
                <p><strong>Вылет:</strong> ${new Date(booking.departure_time).toLocaleString()}</p>
                <p><strong>Тариф:</strong> ${booking.tariff} (${booking.price}₽)</p>
                <p><strong>Пассажир:</strong> ${booking.passenger_lastname} ${booking.passenger_firstname}</p>
                <p><strong>Дата бронирования:</strong> ${new Date(booking.booking_date).toLocaleString()}</p>
            </div>
        `;
    } catch (error) {
        alert('Ошибка при поиске заказа');
        console.error(error);
    }
}

// Закрыть модальное окно
function closeBookingModal() {
    document.getElementById('bookingModal').style.display = 'none';
}

// Закрытие по клику вне окна
window.onclick = function(event) {
    const modal = document.getElementById('bookingModal');
    if (event.target === modal) {
        modal.style.display = 'none';
    }
};

// Админ: добавление рейса
document.getElementById('flightForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const daysSelect = document.getElementById('daysOfWeek');
    const days = Array.from(daysSelect.selectedOptions).map(opt => opt.value);

    if (days.length === 0) {
        alert('Выберите хотя бы один день недели');
        return;
    }

    const flightData = {
        flight_number: document.getElementById('flightNumber').value.trim(),
        origin: document.getElementById('originCity').value.trim(),
        origin_code: document.getElementById('originCode').value.trim().toUpperCase(),
        destination: document.getElementById('destCity').value.trim(),
        destination_code: document.getElementById('destCode').value.trim().toUpperCase(),
        departure_time: document.getElementById('departureTime').value,
        arrival_time: document.getElementById('arrivalTime').value,
        flight_duration: document.getElementById('flightDuration').value.trim(),
        start_date: document.getElementById('startDate').value,
        end_date: document.getElementById('endDate').value,
        days_of_week: days,
        price_min: parseFloat(document.getElementById('priceMin').value),
        price_medium: parseFloat(document.getElementById('priceMedium').value),
        price_max: parseFloat(document.getElementById('priceMax').value)
    };

    try {
        const response = await fetch('/api/flights', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(flightData)
        });

        const result = await response.json();
        document.getElementById('adminResult').innerHTML = `
            <div style="background:#e8f5e9;padding:1rem;border-radius:8px;border:2px solid #4caf50;margin-top:1rem;">
                ✅ Рейс ${result.flight_number} успешно добавлен!
            </div>
        `;
        this.reset();
        setTimeout(() => document.getElementById('adminResult').innerHTML = '', 5000);
    } catch (error) {
        alert('Ошибка при добавлении рейса');
        console.error(error);
    }
});

// Инициализация - показать поиск
showSearch();
