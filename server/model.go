package server

import "strings"

// SubmitRequest is the JSON body for POST /api/submissions.
type SubmitRequest struct {
	Name         string `json:"name"`
	CountryCode  string `json:"country_code"`
	HomelabLevel int    `json:"homelab_level"`
}

// SubmitResponse is the JSON response after a successful submission.
type SubmitResponse struct {
	ID           int64  `json:"id"`
	Name         string `json:"name"`
	CountryCode  string `json:"country_code"`
	CountryFlag  string `json:"country_flag"`
	HomelabLevel int    `json:"homelab_level"`
	HomelabEmoji string `json:"homelab_emoji"`
	CreatedAt    string `json:"created_at"`
}

// ErrorResponse is the JSON error format for 400/422 responses.
type ErrorResponse struct {
	Error string `json:"error"`
	Field string `json:"field,omitempty"`
}

// HomelabEmojis maps homelab level (1-5) to its emoji representation.
var HomelabEmojis = map[int]string{
	1: "\U0001F4AD",     // thinking bubble
	2: "\U0001F353",     // strawberry (Pi)
	3: "\U0001F5A5\uFE0F", // desktop computer
	4: "\U0001F5C4\uFE0F", // file cabinet (rack)
	5: "\U0001F680",     // rocket
}

// countryCodeToFlag converts an ISO 3166-1 alpha-2 country code to its flag emoji
// using the regional indicator symbol offset formula.
func countryCodeToFlag(code string) string {
	code = strings.ToUpper(code)
	var flag strings.Builder
	for _, c := range code {
		flag.WriteRune(rune(c) + 0x1F1A5) // regional indicator offset
	}
	return flag.String()
}

// ValidCountryCodes contains all 249 ISO 3166-1 alpha-2 country codes.
var ValidCountryCodes = map[string]bool{
	"AD": true, "AE": true, "AF": true, "AG": true, "AI": true, "AL": true, "AM": true,
	"AO": true, "AQ": true, "AR": true, "AS": true, "AT": true, "AU": true, "AZ": true,
	"BA": true, "BB": true, "BD": true, "BE": true, "BF": true, "BG": true, "BH": true,
	"BI": true, "BJ": true, "BL": true, "BM": true, "BN": true, "BO": true, "BQ": true,
	"BR": true, "BS": true, "BT": true, "BV": true, "BW": true, "BY": true, "BZ": true,
	"CA": true, "CC": true, "CD": true, "CF": true, "CG": true, "CH": true, "CI": true,
	"CK": true, "CL": true, "CM": true, "CN": true, "CO": true, "CR": true, "CU": true,
	"CV": true, "CW": true, "CX": true, "CY": true, "CZ": true,
	"DE": true, "DJ": true, "DK": true, "DM": true, "DO": true, "DZ": true,
	"EC": true, "EE": true, "EG": true, "EH": true, "ER": true, "ES": true, "ET": true,
	"FI": true, "FJ": true, "FK": true, "FM": true, "FO": true, "FR": true,
	"GA": true, "GB": true, "GD": true, "GE": true, "GF": true, "GG": true, "GH": true,
	"GI": true, "GL": true, "GM": true, "GN": true, "GP": true, "GQ": true, "GR": true,
	"GS": true, "GT": true, "GU": true, "GW": true, "GY": true,
	"HK": true, "HM": true, "HN": true, "HR": true, "HT": true, "HU": true,
	"ID": true, "IE": true, "IL": true, "IM": true, "IN": true, "IO": true, "IQ": true,
	"IR": true, "IS": true, "IT": true,
	"JE": true, "JM": true, "JO": true, "JP": true,
	"KE": true, "KG": true, "KH": true, "KI": true, "KM": true, "KN": true, "KP": true,
	"KR": true, "KW": true, "KY": true, "KZ": true,
	"LA": true, "LB": true, "LC": true, "LI": true, "LK": true, "LR": true, "LS": true,
	"LT": true, "LU": true, "LV": true, "LY": true,
	"MA": true, "MC": true, "MD": true, "ME": true, "MF": true, "MG": true, "MH": true,
	"MK": true, "ML": true, "MM": true, "MN": true, "MO": true, "MP": true, "MQ": true,
	"MR": true, "MS": true, "MT": true, "MU": true, "MV": true, "MW": true, "MX": true,
	"MY": true, "MZ": true,
	"NA": true, "NC": true, "NE": true, "NF": true, "NG": true, "NI": true, "NL": true,
	"NO": true, "NP": true, "NR": true, "NU": true, "NZ": true,
	"OM": true,
	"PA": true, "PE": true, "PF": true, "PG": true, "PH": true, "PK": true, "PL": true,
	"PM": true, "PN": true, "PR": true, "PS": true, "PT": true, "PW": true, "PY": true,
	"QA": true,
	"RE": true, "RO": true, "RS": true, "RU": true, "RW": true,
	"SA": true, "SB": true, "SC": true, "SD": true, "SE": true, "SG": true, "SH": true,
	"SI": true, "SJ": true, "SK": true, "SL": true, "SM": true, "SN": true, "SO": true,
	"SR": true, "SS": true, "ST": true, "SV": true, "SX": true, "SY": true, "SZ": true,
	"TC": true, "TD": true, "TF": true, "TG": true, "TH": true, "TJ": true, "TK": true,
	"TL": true, "TM": true, "TN": true, "TO": true, "TR": true, "TT": true, "TV": true,
	"TW": true, "TZ": true,
	"UA": true, "UG": true, "UM": true, "US": true, "UY": true, "UZ": true,
	"VA": true, "VC": true, "VE": true, "VG": true, "VI": true, "VN": true, "VU": true,
	"WF": true, "WS": true,
	"XK": true,
	"YE": true, "YT": true,
	"ZA": true, "ZM": true, "ZW": true,
}

// AdminStats is the JSON response for GET /api/admin/stats.
type AdminStats struct {
	TotalPods       int            `json:"total_pods"`
	NamespaceCount  int            `json:"namespace_count"`
	TopLocations    []LocationStat `json:"top_locations"`
	SubmissionsOpen bool           `json:"submissions_open"`
}

// LocationStat represents a location with its submission count.
type LocationStat struct {
	CountryCode string `json:"country_code"`
	CountryFlag string `json:"country_flag"`
	Count       int    `json:"count"`
}

// Validate checks a SubmitRequest and returns an ErrorResponse if invalid, or nil if valid.
func Validate(req SubmitRequest) *ErrorResponse {
	if req.Name == "" {
		return &ErrorResponse{Error: "Enter your name to join the cluster", Field: "name"}
	}
	if len([]rune(req.Name)) > 30 {
		return &ErrorResponse{Error: "Name must be 30 characters or fewer", Field: "name"}
	}
	if !ValidCountryCodes[req.CountryCode] {
		return &ErrorResponse{Error: "Select where you're from", Field: "country_code"}
	}
	if req.HomelabLevel < 1 || req.HomelabLevel > 5 {
		return &ErrorResponse{Error: "Pick your homelab level", Field: "homelab_level"}
	}
	return nil
}
