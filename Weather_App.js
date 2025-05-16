const weatherApiKey = '229044f2ce61350307e98beda5224f68';
const timezoneApiKey = 'IUSXX7KNWFNK';

// DOM elements
const locationInput = document.getElementById('location-input');
const searchBtn = document.getElementById('search-btn');
const locationBtn = document.getElementById('location-btn');
const weatherContainer = document.getElementById('weather-container');
const loadingElement = document.getElementById('loading');
const errorElement = document.getElementById('error');

// Weather display elements
const locationElement = document.getElementById('location');
const weatherIcon = document.getElementById('weather-icon');
const temperatureElement = document.getElementById('temperature');
const timeOfDayElement = document.getElementById('time-of-day');
const feelsLikeElement = document.getElementById('feels-like');
const humidityElement = document.getElementById('humidity');
const windSpeedElement = document.getElementById('wind-speed');
const pressureElement = document.getElementById('pressure');
const currentDateElement = document.getElementById('current-date');
const currentTimeElement = document.getElementById('current-time');

// Current city info
let currentCity = {
    name: "",
    lat: 0,
    lon: 0,
    timezone: null, 
    timezoneOffset: 0 
};

function updateDateTime() {
    const now = new Date();
    
    if (currentCity.timezone) {
        const options = {
            timeZone: currentCity.timezone,
            hour: 'numeric',
            minute: 'numeric',
            hour12: true
        };
        
        const dateOptions = {
            timeZone: currentCity.timezone,
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        };
        
        try {
            const formattedTime = now.toLocaleTimeString('en-US', options);
            const formattedDate = now.toLocaleDateString('en-US', dateOptions);
            
            currentTimeElement.textContent = formattedTime;
            currentDateElement.textContent = formattedDate;
        } catch (error) {
            fallbackDateTimeCalculation(now);
        }
    } else if (currentCity.timezoneOffset !== 0) {
        fallbackDateTimeCalculation(now);
    } else {
        const timeOptions = { hour: 'numeric', minute: 'numeric', hour12: true };
        const dateOptions = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };
        
        currentTimeElement.textContent = now.toLocaleTimeString('en-US', timeOptions);
        currentDateElement.textContent = now.toLocaleDateString('en-US', dateOptions);
    }
}

// Fallback time calculation using offset
function fallbackDateTimeCalculation(now) {
    const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
    const cityTime = new Date(utcTime + (currentCity.timezoneOffset * 1000));
    const timeOptions = { hour: 'numeric', minute: 'numeric', hour12: true };
    const dateOptions = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };
    
    currentTimeElement.textContent = cityTime.toLocaleTimeString('en-US', timeOptions);
    currentDateElement.textContent = cityTime.toLocaleDateString('en-US', dateOptions);
}

updateDateTime();
setInterval(updateDateTime, 1000);

searchBtn.addEventListener('click', () => {
    const location = locationInput.value.trim();
    if (location) getWeatherByCity(location);
});

locationInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const location = locationInput.value.trim();
        if (location) getWeatherByCity(location);
    }
});

locationBtn.addEventListener('click', () => {
    if (navigator.geolocation) {
        showLoading();
        navigator.geolocation.getCurrentPosition(
            (pos) => getWeatherByCoordinates(pos.coords.latitude, pos.coords.longitude),
            () => {
                hideLoading();
                showError('Could not access your location. Please allow location access or enter a city manually.');
            }
        );
    } else {
        showError('Geolocation not supported by your browser.');
    }
});

// Fetch weather by city name
function getWeatherByCity(city) {
    showLoading();
    fetch(`https://api.openweathermap.org/data/2.5/weather?q=${city}&units=metric&appid=${weatherApiKey}`)
        .then(res => {
            if (!res.ok) throw new Error('City not found');
            return res.json();
        })
        .then(data => {
            currentCity.lat = data.coord.lat;
            currentCity.lon = data.coord.lon;
            return fetchTimezoneInfo(data.coord.lat, data.coord.lon)
                .then(timezoneData => {
                    processTimezoneData(timezoneData);
                    displayWeatherData(data);
                });
        })
        .catch(error => {
            console.error('Error:', error);
            showError('City not found or network error. Please check spelling and try again.');
        })
        .finally(() => hideLoading());
}

// Fetch weather by GPS coordinates
function getWeatherByCoordinates(lat, lon) {
    fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${weatherApiKey}`)
        .then(res => {
            if (!res.ok) throw new Error('Location error');
            return res.json();
        })
        .then(data => {
            currentCity.lat = lat;
            currentCity.lon = lon;
            return fetchTimezoneInfo(lat, lon)
                .then(timezoneData => {
                    processTimezoneData(timezoneData);
                    displayWeatherData(data);
                });
        })
        .catch(error => {
            console.error('Error:', error);
            showError('Could not fetch weather for your location.');
        })
        .finally(() => hideLoading());
}

// Fetch timezone information from TimeZoneDB API
function fetchTimezoneInfo(lat, lon) {
    return fetch(`https://api.timezonedb.com/v2.1/get-time-zone?key=${timezoneApiKey}&format=json&by=position&lat=${lat}&lng=${lon}`)
        .then(res => {
            if (!res.ok) throw new Error('Timezone lookup failed');
            return res.json();
        })
        .catch(error => {
            console.error('Timezone API error:', error);
            return {
                status: 'FALLBACK',
                gmtOffset: calculateTimezoneOffset(lon) * 3600,
                zoneName: null
            };
        });
}

// Process timezone data from API
function processTimezoneData(data) {
    if (data.status === 'OK' || data.status === 'FALLBACK') {
        currentCity.timezoneOffset = data.gmtOffset;
        currentCity.timezone = data.zoneName; 
        updateDateTime();
    } else {
        console.error('Timezone data error:', data);
        currentCity.timezoneOffset = calculateTimezoneOffset(currentCity.lon) * 3600;
        currentCity.timezone = null;
    }
}

// Calculate timezone offset in hours based on longitude (as fallback)
function calculateTimezoneOffset(longitude) {
    return Math.round(longitude / 15);
}

// Display weather details
function displayWeatherData(data) {
    currentCity.name = data.name;
    
    // Update the elements
    locationElement.textContent = data.name;
    temperatureElement.textContent = `${Math.round(data.main.temp)}°C`;
    
    // Get weather condition and emoji
    const weatherCondition = data.weather[0].main;
    const weatherDescription = data.weather[0].description;
    const emoji = getWeatherEmoji(weatherCondition);
    
    // Display weather condition with emoji
    timeOfDayElement.innerHTML = `${emoji} ${weatherDescription}`;
    
    // Set weather icon
    weatherIcon.src = `https://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png`;
    weatherIcon.alt = weatherDescription;

    // Set other weather details
    feelsLikeElement.textContent = `${Math.round(data.main.feels_like)}°C`;
    humidityElement.textContent = `${data.main.humidity}%`;
    windSpeedElement.textContent = `${data.wind.speed} m/s`;
    pressureElement.textContent = `${data.main.pressure} hPa`;

    hideError();
    weatherContainer.classList.add('active');
}

// Get emoji for weather condition
function getWeatherEmoji(condition) {
    switch (condition.toLowerCase()) {
        case 'clear': return '☀️';
        case 'clouds': return '☁️';
        case 'few clouds':
        case 'scattered clouds': return '🌤️';
        case 'broken clouds':
        case 'overcast clouds': return '☁️';
        case 'shower rain': return '🌦️';
        case 'rain': return '🌧️';
        case 'light rain': return '🌦️';
        case 'moderate rain': return '🌧️';
        case 'heavy rain': return '⛆';
        case 'thunderstorm': return '⛈️';
        case 'drizzle': return '🌧️';
        case 'snow': return '❄️';
        case 'light snow': return '🌨️';
        case 'heavy snow': return '❄️';
        case 'mist':
        case 'fog':
        case 'haze': return '🌫️';
        case 'smoke': return '💨';
        case 'dust':
        case 'sand': return '🌪️';
        case 'ash': return '🌋';
        case 'squall': return '💨';
        case 'tornado': return '🌪️';
        default: return '🌡️';
    }
}

// UI helpers
function showLoading() {
    loadingElement.style.display = 'block';
    weatherContainer.classList.remove('active');
    hideError();
}

function hideLoading() {
    loadingElement.style.display = 'none';
}

function showError(message) {
    errorElement.innerHTML = `<p>${message}</p>`;
    errorElement.style.display = 'block';
    weatherContainer.classList.remove('active');
}

function hideError() {
    errorElement.style.display = 'none';
}