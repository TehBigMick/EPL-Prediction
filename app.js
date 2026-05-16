// Initialize Supabase
const supabaseUrl = "https://reqoykoevyggemmspszc.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlcW95a29ldnlnZ2VtbXNwc3pjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5MzAyNTksImV4cCI6MjA5NDUwNjI1OX0.70dkxT--W5zbc4vWYcusrhzpivmSLbuP3GQNqxKNlLw"; // <-- Replace with your anon key
const supabase = supabase.createClient(supabaseUrl, supabaseKey);

// Current user UUID (Alice)
const CURRENT_USER_ID = "ecf079bc-7e6a-4f61-827d-4d5f939c1844";

// Load upcoming matches
async function loadMatches() {
  const { data: matches } = await supabase
    .from("matches")
    .select("*")
    .order("match_date", { ascending: true });

  const tbody = document.querySelector("#matches-table tbody");
  tbody.innerHTML = "";

  for (let match of matches) {
    const { data: pred } = await supabase
      .from("predictions")
      .select("*")
      .eq("user_id", CURRENT_USER_ID)
      .eq("match_id", match.id)
      .single();

    const homeVal = pred ? pred.predicted_home : "";
    const awayVal = pred ? pred.predicted_away : "";

    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${match.home_team}</td>
      <td>${match.away_team}</td>
      <td>
        <input type="number" id="home-${match.id}" value="${homeVal}" ${match.is_locked ? "disabled" : ""}>
        -
        <input type="number" id="away-${match.id}" value="${awayVal}" ${match.is_locked ? "disabled" : ""}>
      </td>
      <td>
        <button onclick="submitPrediction('${match.id}', ${match.is_locked})" ${match.is_locked ? "disabled" : ""}>
          Submit
        </button>
      </td>
    `;
    tbody.appendChild(row);
  }
}

// Submit or update prediction
async function submitPrediction(matchId, isLocked) {
  if (isLocked) return alert("Predictions are locked for this match.");

  const homeScore = parseInt(document.getElementById(`home-${matchId}`).value);
  const awayScore = parseInt(document.getElementById(`away-${matchId}`).value);

  if (isNaN(homeScore) || isNaN(awayScore)) {
    return alert("Please enter both scores.");
  }

  const { data: existing } = await supabase
    .from("predictions")
    .select("*")
    .eq("user_id", CURRENT_USER_ID)
    .eq("match_id", matchId)
    .single();

  if (existing) {
    await supabase
      .from("predictions")
      .update({ predicted_home: homeScore, predicted_away: awayScore })
      .eq("id", existing.id);
  } else {
    await supabase
      .from("predictions")
      .insert([{ user_id: CURRENT_USER_ID, match_id: matchId, predicted_home: homeScore, predicted_away: awayScore }]);
  }

  alert("Prediction saved!");
  loadMatches();
  loadLeaderboard();
}

// Load leaderboard
async function loadLeaderboard() {
  const { data: leaderboard } = await supabase
    .from("users")
    .select("*")
    .order("total_points", { ascending: false });

  const tbody = document.querySelector("#leaderboard-table tbody");
  tbody.innerHTML = "";

  leaderboard.forEach((user, index) => {
    const row = document.createElement("tr");
    row.innerHTML = `<td>${index + 1}</td><td>${user.display_name}</td><td>${user.total_points}</td>`;
    tbody.appendChild(row);
  });
}

// Initial load
loadMatches();
loadLeaderboard();
