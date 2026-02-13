import Foundation

/// Errors that can occur during attribution
public enum AttributionError: Error, LocalizedError {
    case notConfigured
    case invalidURL
    case networkError(Error)
    case invalidResponse
    case serverError(String)
    case noData
    case decodingError(Error)
    
    public var errorDescription: String? {
        switch self {
        case .notConfigured:
            return "Attribution SDK not configured. Call configure() first."
        case .invalidURL:
            return "Invalid API URL"
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        case .invalidResponse:
            return "Invalid response from server"
        case .serverError(let message):
            return "Server error: \(message)"
        case .noData:
            return "No data received from server"
        case .decodingError(let error):
            return "Failed to decode response: \(error.localizedDescription)"
        }
    }
}
