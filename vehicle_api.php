<?php

require 'vendor/autoload.php';

use Symfony\Component\Panther\Client;
use Facebook\WebDriver\WebDriverKeys;

header('Content-Type: application/json');
// Sem CORS: este serviço só é chamado pelo servidor da aplicação LogiCar, nunca por browsers.

// Registo fora da pasta pública (o antigo scraping_log.txt ficava acessível pela web).
define('API_LOG_FILE', getenv('VEHICLE_API_LOG') ?: sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'logicar-vehicle-api.log');
function api_log($message) {
    file_put_contents(API_LOG_FILE, date('Y-m-d H:i:s') . ': ' . $message . "\n", FILE_APPEND);
}
// As matrículas são dados pessoais: no registo só aparecem os 2 primeiros caracteres.
function mask_plate($plate) {
    return substr((string) $plate, 0, 2) . '***';
}
function api_error($status, $message) {
    http_response_code($status);
    echo json_encode(['success' => false, 'error' => $message]);
    exit;
}

// Segredo partilhado com a aplicação (header X-Api-Key). Definir VEHICLE_API_KEY no servidor PHP
// e o mesmo valor no .env da aplicação. Sem ele, qualquer pessoa pode usar este serviço.
$expectedKey = getenv('VEHICLE_API_KEY');
if ($expectedKey !== false && $expectedKey !== '') {
    $givenKey = $_SERVER['HTTP_X_API_KEY'] ?? '';
    if (!hash_equals($expectedKey, $givenKey)) {
        api_error(401, 'Não autorizado');
    }
}

// Limite por IP: cada pedido abre um Chrome (VEHICLE_API_RATE_LIMIT pedidos em 15 minutos, 30 por omissão).
$limit = (int) (getenv('VEHICLE_API_RATE_LIMIT') ?: 30);
$rateFile = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'logicar-rate-' . md5($_SERVER['REMOTE_ADDR'] ?? 'unknown');
$now = time();
$hits = array_filter(
    is_file($rateFile) ? array_map('intval', file($rateFile, FILE_IGNORE_NEW_LINES)) : [],
    fn($t) => $t > $now - 900
);
if (count($hits) >= $limit) {
    api_error(429, 'Demasiados pedidos. Tente novamente mais tarde.');
}
$hits[] = $now;
file_put_contents($rateFile, implode("\n", $hits), LOCK_EX);

class VehicleApiService {
    private $baseUrl = 'https://infomatricula.pt/';

    public function getVehicleByLicensePlate($licensePlate) {
        api_log('Starting scraping for license plate: ' . mask_plate($licensePlate));
        // Try to return cached result from DB first
        try {
            $pdo = $this->getPdo();
            if ($pdo) {
                $cached = $this->findCachedVehicle($licensePlate);
                if ($cached !== null) {
                    api_log('Returning cached data for license plate: ' . mask_plate($licensePlate));
                    return $cached;
                }
            }
        } catch (Exception $e) {
            // If DB is unavailable, just continue with scraping
            api_log('DB cache check error: ' . $e->getMessage());
        }
        try {
            // Create Chrome client. Avoid insecure flags like --disable-web-security.
            $client = Client::createChromeClient(null, null, [
                'chrome' => [
                    '--window-size=1920,1080',
                    '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    '--no-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-blink-features=AutomationControlled',
                    '--headless=new'
                ],
                'chromedriver' => __DIR__ . '/chromedriver.exe'
            ]);

            $resultPage = null;
            $crawler = $client->request('GET', $this->baseUrl);
            sleep(3);

            $initialContent = $crawler->html();
            api_log('Initial page length: ' . strlen($initialContent));

            // Handle cookie consent
            try {
                $consentButtons = $crawler->filter('button');
                if ($consentButtons->count() > 0) {
                    foreach ($consentButtons as $button) {
                        if (stripos($button->getText(), 'Consentir') !== false) {
                            $button->click();
                            sleep(2);
                            api_log('Consent button clicked');
                            break;
                        }
                    }
                }
            } catch (Exception $e) {
                api_log('Cookie consent error: ' . $e->getMessage());
            }

            // Find search input field - using more specific selectors
            $searchInput = null;
            $selectors = [
                'input[name="matricula"]',
                'input[type="text"][class*="font-din"]',
                'input[placeholder*="matrícula"]',
                'input[placeholder*="Matrícula"]',
                '#search-input',
                '.search-input',
                'form input[type="text"]'
            ];

            foreach ($selectors as $selector) {
                try {
                    $searchInput = $crawler->filter($selector);
                    if ($searchInput->count() > 0) {
                        api_log('Found input with selector: ' . $selector);
                        break;
                    }
                } catch (Exception $e) {
                    continue;
                }
            }

            if (!$searchInput || $searchInput->count() === 0) {
                api_log('No search input found');
                throw new Exception('Campo de pesquisa não encontrado');
            }

            sleep(2);
            
            try {
                // FIX: Proper way to clear input field with WebDriver
                // Get the WebDriver element using the correct index (0 for first element)
                $searchInputElement = $searchInput->getElement(0);
                
                // Clear the input by selecting all text and deleting
                $searchInputElement->sendKeys([WebDriverKeys::CONTROL, 'a']);
                $searchInputElement->sendKeys(WebDriverKeys::DELETE);
                
                // Type the license plate
                $searchInputElement->sendKeys($licensePlate);
                
                sleep(1);
                api_log('License plate typed: ' . mask_plate($licensePlate));
            } catch (Exception $e) {
                api_log('Error interacting with input: ' . $e->getMessage());
                $client->quit();
                throw new Exception('Erro ao interagir com o campo de pesquisa');
            }

            // Find submit button or press Enter
            $submitButton = null;
            $submitSelectors = [
                'button[type="submit"]',
                'input[type="submit"]',
                '.btn-search',
                '.search-btn',
                'form button'
            ];

            foreach ($submitSelectors as $selector) {
                try {
                    $submitButton = $crawler->filter($selector);
                    if ($submitButton->count() > 0) {
                        $submitButton->first()->click();
                        api_log('Submit button clicked with selector: ' . $selector);
                        break;
                    }
                } catch (Exception $e) {
                    continue;
                }
            }

            if (!$submitButton || $submitButton->count() === 0) {
                $searchInputElement->sendKeys(WebDriverKeys::ENTER);
                api_log('Sent Enter on input');
            }
            // Wait for results to load - prefer explicit wait in production
            sleep(10);

            // Get final page content from the WebDriver (more reliable after interactions)
            try {
                $content = $client->getWebDriver()->getPageSource();
            } catch (Exception $e) {
                // Fallback to crawler html if getPageSource fails
                $content = $crawler->html();
            }

            api_log('Final page length: ' . strlen($content));
            api_log('Final page contains license plate: ' . (strpos($content, mask_plate($licensePlate)) !== false ? 'yes' : 'no'));

            if (strpos($content, $licensePlate) !== false && strlen($content) > 10000) {
                $resultPage = $content;
                api_log('Data found successfully');
            } else {
                api_log('Data not found');
            }

            if (!$resultPage) {
                throw new Exception('Não foi possível acessar o site ou dados não encontrados');
            }

            // Extract vehicle data from result page
            $extracted = $this->extractVehicleData($resultPage, $licensePlate);

            // Save to cache if we have a valid result
            try {
                if ($extracted && is_array($extracted)) {
                    $pdo = $this->getPdo();
                    if ($pdo) {
                        $this->saveCachedVehicle($licensePlate, $extracted);
                        api_log('Saved scraped data to cache for: ' . mask_plate($licensePlate));
                    }
                }
            } catch (Exception $e) {
                api_log('Error saving cache: ' . $e->getMessage());
            }

            return $extracted;

        } catch (Exception $e) {
            api_log('Exception in getVehicleByLicensePlate: ' . $e->getMessage());
            return null;
        } finally {
            // Ensure the client is always closed to free resources
            try {
                if (isset($client) && method_exists($client, 'quit')) {
                    $client->quit();
                }
            } catch (Exception $e) {
                // ignore
            }
        }
    }

    /**
     * Validate a license plate string to avoid invalid input
     */
    private function isValidLicensePlate($plate) {
        $p = trim($plate);
        // Basic validation: allow letters, numbers, spaces and dashes; length between 4 and 12
        if (preg_match('/^[A-Za-z0-9\s\-]{4,12}$/', $p)) {
            return true;
        }
        return false;
    }
    
    /**
     * Extract data from card elements using XPath
     */
    private function extractVehicleData($pageText, $licensePlate) {
        // Check if this looks like a vehicle details page
        if (strpos($pageText, 'veículo não encontrado') !== false ||
            strpos($pageText, 'matrícula não existe') !== false ||
            strpos($pageText, 'não foi encontrado') !== false) {
            return null;
        }
    
        // Convert HTML entities and clean up text
        $pageText = html_entity_decode($pageText, ENT_QUOTES | ENT_HTML5);
        
        // Use DOMDocument for better parsing
        $dom = new DOMDocument();
        @$dom->loadHTML($pageText);
        $xpath = new DOMXPath($dom);
        
        // Improved extraction using the site's actual structure
        $data = [
            'licensePlate' => $licensePlate,
            'brand' => $this->extractCardValue($xpath, 'Marca'),
            'model' => $this->extractCardValue($xpath, 'Modelo'),
            'fuelType' => $this->extractCardValue($xpath, 'Combustível'),
            'year' => $this->extractCardValue($xpath, ['Ano', 'Ano de fabrico', 'Ano de registo', 'Data de registo']),
            'cylinderCapacity' => $this->extractCardValue($xpath, ['Cilindrada', 'Cilindrada (cm3)']),
            'powerCV' => $this->extractCardValue($xpath, ['Potência (CV)', 'CV', 'Potência']),
            'powerKW' => $this->extractCardValue($xpath, ['Potência (kW)', 'kW']),
            'co2Emissions' => $this->extractCardValue($xpath, ['Emissões CO2', 'CO2']),
            'category' => $this->extractCardValue($xpath, ['Categoria', 'Tipo de veículo']),
            'iucCategory' => $this->extractCardValue($xpath, ['Categoria IUC', 'IUC']),
            'registrationDate' => $this->extractCardValue($xpath, ['Data de matrícula', 'Data de registo']),
            'inspectionDate' => $this->extractCardValue($xpath, ['Data de inspeção', 'Última inspeção']),
            'inspectionValidity' => $this->extractCardValue($xpath, ['Validade da inspeção', 'Próxima inspeção']),
            'engineDisplacement' => $this->extractCardValue($xpath, ['Cilindrada do motor']),
            'ownerType' => $this->extractCardValue($xpath, ['Tipo de Proprietário', 'Proprietário']),
            'entity' => $this->extractCardValue($xpath, ['Entidade', 'Empresa']),
            'segment' => $this->extractCardValue($xpath, ['Segmento', 'Segment']),
            'traction' => $this->extractCardValue($xpath, ['Tração', 'Tracao']),
            'vin' => $this->extractCardValue($xpath, ['VIN']),
            'version' => $this->extractCardValue($xpath, ['Versão']),
            'production' => $this->extractCardValue($xpath, ['Produção']),
            'origin' => $this->extractCardValue($xpath, ['Origem']),
            'policy' => $this->extractCardValue($xpath, ['Apólice']),
            'insuranceStart' => $this->extractCardValue($xpath, ['Início']),
            'insuranceEnd' => $this->extractCardValue($xpath, ['Fim'])
        ];
    
        // Fallback to text-based extraction if DOM extraction failed
        if (empty($data['brand']) && empty($data['model'])) {
            api_log('DOM extraction failed, trying text patterns');
            
            // Use the improved text extraction
            $data['brand'] = $this->extractFieldText($pageText, ['Marca']);
            $data['model'] = $this->extractFieldText($pageText, ['Modelo']);
            $data['fuelType'] = $this->extractFieldText($pageText, ['Combustível']);
            $data['year'] = $this->extractFieldText($pageText, ['Producao', 'Produção', 'Ano']);
            $data['cylinderCapacity'] = $this->extractFieldText($pageText, ['Cilindrada']);
            $data['powerCV'] = $this->extractFieldText($pageText, ['Potência (CV)', 'Potência máxima (CV)', 'Potência', 'Potência máxima', 'CV', 'Potência (cv)', 'Potência máxima (cv)']);
            $data['powerKW'] = $this->extractFieldText($pageText, ['Potência (kW)', 'Potência máxima (kW)', 'Potência', 'Potência máxima', 'kW', 'Potência (kw)', 'Potência máxima (kw)']);
            $data['co2Emissions'] = $this->extractFieldText($pageText, ['CO2']);
            $data['category'] = $this->extractFieldText($pageText, ['Categoria']);
            $data['iucCategory'] = $this->extractFieldText($pageText, ['Categoria IUC']);
            $data['registrationDate'] = $this->extractFieldText($pageText, ['Data de matrícula', 'Registo']);
            $data['inspectionDate'] = $this->extractFieldText($pageText, ['Data de inspeção']);
            $data['inspectionValidity'] = $this->extractFieldText($pageText, ['Validade da inspeção']);
            $data['engineDisplacement'] = $this->extractFieldText($pageText, ['Cilindrada do motor']);
            $data['ownerType'] = $this->extractFieldText($pageText, ['Tipo de Proprietário']);
            $data['entity'] = $this->extractFieldText($pageText, ['Entidade']);
            $data['segment'] = $this->extractFieldText($pageText, ['Segmento', 'Segment', 'SEGMENTO']);
            $data['traction'] = $this->extractFieldText($pageText, ['Tração', 'Tracao', 'TRAÇÃO', 'TRACAO']);
            $data['vin'] = $this->extractFieldText($pageText, ['VIN']);
            $data['version'] = $this->extractFieldText($pageText, ['Versão']);
            $data['production'] = $this->extractFieldText($pageText, ['Produção']);
            $data['origin'] = $this->extractFieldText($pageText, ['Origem']);
            $data['policy'] = $this->extractFieldText($pageText, ['Apólice']);
            $data['insuranceStart'] = $this->extractFieldText($pageText, ['Início']);
            $data['insuranceEnd'] = $this->extractFieldText($pageText, ['Fim']);
        }
        
        // NEW: Special handling for powerKW if it's empty but powerCV exists
        if (empty($data['powerKW']) && !empty($data['powerCV'])) {
            // Try to find kW value using a more specific approach
            $data['powerKW'] = $this->extractPowerKW($pageText, $data['powerCV']);
            
            // If still not found, try to convert from CV to kW
            if (empty($data['powerKW']) && is_numeric($data['powerCV'])) {
                $data['powerKW'] = round($data['powerCV'] * 0.73549875); // Conversion formula
            }
        }

        // Check if we have valid data
        $hasValidData = !empty($data['brand']) || !empty($data['model']) ||
                       !empty($data['fuelType']) || !empty($data['year']) ||
                       !empty($data['category']) || !empty($data['entity']);

        if ($hasValidData) {
            return $data;
        } else {
            file_put_contents(__DIR__ . '/debug_page.html', $pageText);
            api_log('No valid data found, page saved to debug_page.html');
            return null;
        }
    }

    /**
     * NEW: Special function to extract powerKW value
     */
    private function extractPowerKW($pageText, $powerCV) {
        // Look for patterns that specifically indicate kW values
        $patterns = [
            // Pattern for explicit kW labels
            '/Potência\s*\(kW\)[^>]*>([^<]+)/i',
            '/Potência máxima\s*\(kW\)[^>]*>([^<]+)/i',
            '/kW[^>]*>([^<]+)/i',
            
            // Pattern for values near kW mentions
            '/(\d+)\s*(?:kW|KW|kilowatt)/i',
            
            // Pattern for table-like structures with kW
            '/<tr[^>]*>.*?kW.*?<td[^>]*>([^<]+)<\/td>/is',
            
            // Pattern for card structures with kW
            '/<div[^>]*>.*?kW.*?<div[^>]*>([^<]+)<\/div>/is',
        ];
        
        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $pageText, $matches)) {
                $result = trim($matches[1]);
                $result = strip_tags($result);
                $result = html_entity_decode($result, ENT_QUOTES | ENT_HTML5);
                $result = preg_replace('/\s+/', ' ', $result);
                
                // Clean the value
                $result = preg_replace('/[^\d.,]/', '', $result);
                $result = str_replace(',', '.', $result);
                
                if (is_numeric($result) && $result > 0) {
                    return $result;
                }
            }
        }
        
        return '';
    }

    /**
     * Improved card value extraction based on site structure
     */
    private function extractCardValue($xpath, $searchTerms) {
        if (!is_array($searchTerms)) {
            $searchTerms = [$searchTerms];
        }
        
        foreach ($searchTerms as $term) {
            // Try multiple patterns for the site structure
            $patterns = [
                // Pattern 1: Look for label followed by value in card structure
                "//div[contains(@class, 'card')]//p[contains(text(), '{$term}')]/following-sibling::div[contains(@class, 'text-')]",
                "//div[contains(@class, 'card')]//span[contains(text(), '{$term}')]/following-sibling::span",
                "//*[contains(text(), '{$term}')]/following-sibling::*[contains(@class, 'value') or contains(@class, 'text-')]",
                
                // Pattern 2: Look for specific data attributes
                "//div[@data-label='{$term}']",
                "//div[contains(@aria-label, '{$term}')]",
                
                // Pattern 3: Table-like structure
                "//tr[contains(., '{$term}')]/td[2]",
                "//div[contains(., '{$term}')]/div[contains(@class, 'value')]"
            ];
            
            foreach ($patterns as $pattern) {
                try {
                    $nodes = $xpath->query($pattern);
                    if ($nodes->length > 0) {
                        $value = trim($nodes->item(0)->textContent);
                        
                        // Clean the value by removing the search term prefix
                        $cleanedValue = $this->cleanValue($value, $term);
                        
                        if (!empty($cleanedValue) && $cleanedValue !== $term && $this->isValidResult($cleanedValue, $term)) {
                            return $cleanedValue;
                        }
                    }
                } catch (Exception $e) {
                    continue;
                }
            }
        }
        
        return '';
    }

    /**
     * Clean value by removing the search term prefix and any unwanted characters
    */
    private function cleanValue($value, $searchTerm) {
        // First, try simple string replacement for common cases
        $cleaned = $value;
        
        // Remove the search term from the beginning (case insensitive)
        $cleaned = preg_replace('/^' . preg_quote($searchTerm, '/') . '[-:\s]*/i', '', $cleaned);
        
        // Remove common prefixes that might be attached (simple string replacement)
        $commonPrefixes = ['Marca', 'Modelo', 'Combustível', 'Segmento', 'Tração', 'Versão', 'Origem', 'VIN'];
        foreach ($commonPrefixes as $prefix) {
            if (stripos($cleaned, $prefix) === 0) {
                $cleaned = substr($cleaned, strlen($prefix));
                break;
            }
        }
        
        // Remove any remaining special characters at the beginning
        $cleaned = preg_replace('/^[:\-\s]+/', '', $cleaned);
        
        // Trim and clean up
        $cleaned = trim($cleaned);
        $cleaned = preg_replace('/\s+/', ' ', $cleaned);
        
        return $cleaned;
    }
    
    /**
     * Improved text-based extraction based on your Node.js patterns
     */
    private function extractFieldText($text, $searchTerms) {
        foreach ($searchTerms as $term) {
            // Enhanced patterns from your Node.js version
            $patterns = [
                // Pattern for "Label\nValue" structure
                "/{$term}\s*\n\s*(\d{1,4}(?:[.,]\d+)?)\s*-?\s*/i",
                "/{$term}\s*\n\s*(\d{1,4}(?:[.,]\d+)?)/i",
                "/{$term}\s*[:\-]?\s*(\d{1,4}(?:[.,]\d+)?)(?:\s*(CV|K?W|cv|kw))?/i",
                
                // Pattern for card-like structure - capture only the value part
                "/<[^>]*>\s*{$term}\s*<\/[^>]*>\s*<[^>]*>([^<]+)<\/[^>]*>/i",
                "/{$term}\s*[:\-]\s*([^\n<]+)/i",
                "/{$term}\s*\n\s*([^\n<]+)/i",
                
                // New pattern to capture just the value without the label
                "/{$term}[^>]*>([^<]+)</i"
            ];
        
            foreach ($patterns as $pattern) {
                if (preg_match($pattern, $text, $matches)) {
                    $result = trim($matches[1]);
                    $result = strip_tags($result);
                    $result = html_entity_decode($result, ENT_QUOTES | ENT_HTML5);
                    $result = preg_replace('/\s+/', ' ', $result);
                    
                    // Clean the value by removing any remaining label parts
                    $result = $this->cleanValue($result, $term);
        
                    if ($this->isValidResult($result, $term)) {
                        return $result;
                    }
                }
            }
        }
        
        return '';
    }
    
    /**
     * Improved validation function
     */
    private function isValidResult($result, $fieldType) {
        $unwantedTerms = [
            'infomatricula', 'todos os direitos', 'página inicial', 'não seja',
            'consentimento', 'solicita', 'publicidade', 'consentir', 'gerir opções',
            'saiba mais', 'termos e condições', 'política de privacidade', 'contacto',
            'comparação automóveis', 'evite problemas', 'compre o melhor', 'simulador iuc'
        ];
    
        $lowerResult = strtolower($result);
        $lowerFieldType = strtolower($fieldType);
    
        // Check for unwanted terms
        foreach ($unwantedTerms as $term) {
            if (strpos($lowerResult, $term) !== false) {
                return false;
            }
        }
    
        // Check length
        if (strlen($result) === 0 || strlen($result) > 150) {
            return false;
        }
    
        // Field-specific validations
        if (strpos($lowerFieldType, 'ano') !== false || strpos($lowerFieldType, 'year') !== false) {
            return preg_match('/^\d{4}$/', $result);
        }
    
        if (strpos($lowerFieldType, 'produção') !== false) {
            return preg_match('/^\d{4}$/', $result);
        }
    
        if (strpos($lowerFieldType, 'iuc') !== false) {
            return preg_match('/^[A-Z]$/', $result);
        }
    
        if (strpos($lowerFieldType, 'co2') !== false) {
            return preg_match('/^\d+(\.\d+)?(\s*(g\/km)?)?$/i', $result);
        }
    
        if (strpos($lowerFieldType, 'cilindrada') !== false) {
            return preg_match('/^\d+(\.\d+)?(\s*(cm³|cc)?)?$/i', $result);
        }
    
        if (strpos($lowerFieldType, 'potência') !== false ||
            strpos($lowerFieldType, 'power') !== false ||
            strpos($lowerFieldType, 'cv') !== false ||
            strpos($lowerFieldType, 'kw') !== false) {
            return preg_match('/^\d{1,5}(\.\d+)?(\s*(kW|CV|kw|cv))?$/', $result) ||
                   preg_match('/^\d{1,5}(\.\d+)?\s*\/\s*\d{1,5}(\.\d+)?$/', $result);
        }
    
        if (strpos($lowerFieldType, 'proprietário') !== false ||
            strpos($lowerFieldType, 'owner') !== false) {
            return preg_match('/^(Proprietário|Empresa|Particular|Comercial|Estado)$/i', $result);
        }
    
        return preg_match('/[A-Za-z0-9]/', $result);
    }

    /**
     * Database helpers for caching scraped vehicle data
     */
    private function getPdo() {
        // Read credentials from environment or fallback to defaults
        $host = getenv('MYSQL_HOST') ?: '127.0.0.1';
        $port = getenv('MYSQL_PORT') ?: '3306';
        $user = getenv('MYSQL_USER') ?: 'root';
        $pass = getenv('MYSQL_PASSWORD') ?: '';
        $db = getenv('MYSQL_DATABASE') ?: 'vehiclecare';

        try {
            $dsn = "mysql:host={$host};port={$port};dbname={$db};charset=utf8mb4";
            $options = [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ];
            return new PDO($dsn, $user, $pass, $options);
        } catch (Exception $e) {
            api_log('PDO connection error: ' . $e->getMessage());
            return null;
        }
    }


    private function findCachedVehicle($licensePlate) {
        $pdo = $this->getPdo();
        if (!$pdo) return null;
        try {
            $stmt = $pdo->prepare('SELECT data, power_cv, power_kw, color, origin, brand, model, year FROM scraped_vehicles WHERE license_plate = :plate LIMIT 1');
            $stmt->execute([':plate' => $licensePlate]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($row && !empty($row['data'])) {
                $data = json_decode($row['data'], true);
                // Merge structured fields if they exist and not present in JSON
                if (!isset($data['powerCV']) && isset($row['power_cv']) && $row['power_cv'] !== null) $data['powerCV'] = $row['power_cv'];
                if (!isset($data['powerKW']) && isset($row['power_kw']) && $row['power_kw'] !== null) $data['powerKW'] = $row['power_kw'];
                if (!isset($data['color']) && isset($row['color']) && $row['color'] !== null) $data['color'] = $row['color'];
                if (!isset($data['origin']) && isset($row['origin']) && $row['origin'] !== null) $data['origin'] = $row['origin'];
                if (!isset($data['brand']) && isset($row['brand']) && $row['brand'] !== null) $data['brand'] = $row['brand'];
                if (!isset($data['model']) && isset($row['model']) && $row['model'] !== null) $data['model'] = $row['model'];
                if (!isset($data['year']) && isset($row['year']) && $row['year'] !== null) $data['year'] = $row['year'];
                return $data;
            }
        } catch (Exception $e) {
            api_log('findCachedVehicle error: ' . $e->getMessage());
        }
        return null;
    }

    private function saveCachedVehicle($licensePlate, $data) {
        $pdo = $this->getPdo();
        if (!$pdo) return false;
        try {
            $json = json_encode($data, JSON_UNESCAPED_UNICODE);
            // Extract structured fields if present
            $power_cv = null;
            $power_kw = null;
            $color = null;
            $origin = null;
            $brand = null;
            $model = null;
            $year = null;
            if (is_array($data)) {
                if (!empty($data['powerCV'])) $power_cv = is_numeric($data['powerCV']) ? intval($data['powerCV']) : null;
                if (!empty($data['powerKW'])) $power_kw = is_numeric($data['powerKW']) ? intval($data['powerKW']) : null;
                if (!empty($data['color'])) $color = substr($data['color'], 0, 50);
                if (!empty($data['origin'])) $origin = substr($data['origin'], 0, 100);
                if (!empty($data['brand'])) $brand = substr($data['brand'], 0, 100);
                if (!empty($data['model'])) $model = substr($data['model'], 0, 100);
                if (!empty($data['year']) && is_numeric($data['year'])) $year = intval($data['year']);
            }

            $stmt = $pdo->prepare('REPLACE INTO scraped_vehicles (license_plate, data, power_cv, power_kw, color, origin, brand, model, year, updated_at) VALUES (:plate, :data, :power_cv, :power_kw, :color, :origin, :brand, :model, :year, NOW())');
            $stmt->execute([
                ':plate' => $licensePlate,
                ':data' => $json,
                ':power_cv' => $power_cv,
                ':power_kw' => $power_kw,
                ':color' => $color,
                ':origin' => $origin,
                ':brand' => $brand,
                ':model' => $model,
                ':year' => $year
            ]);
            return true;
        } catch (Exception $e) {
            api_log('saveCachedVehicle error: ' . $e->getMessage());
            return false;
        }
    }
}

// Handle API request
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['license_plate'])) {
    $licensePlate = trim($_GET['license_plate']);

    if (empty($licensePlate)) {
        http_response_code(400);
        echo json_encode(['error' => 'Matrícula não fornecida']);
        exit;
    }

    // Basic validation: letters, numbers, spaces and dashes; length between 4 and 12
    if (!preg_match('/^[A-Za-z0-9\s\-]{4,12}$/', $licensePlate)) {
        http_response_code(400);
        echo json_encode(['error' => 'Matrícula inválida']);
        exit;
    }

    $service = new VehicleApiService();
    $result = $service->getVehicleByLicensePlate($licensePlate);

    if ($result) {
        http_response_code(200);
        echo json_encode(['success' => true, 'data' => $result]);
    } else {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Dados não encontrados']);
    }
} else {
    http_response_code(405);
    echo json_encode(['error' => 'Método não permitido ou parâmetro matrícula ausente']);
}