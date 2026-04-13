#!/usr/bin/env python3
"""
ThreadlyCo Design Studio - Backend API Testing
==============================================
Comprehensive test suite for all backend API endpoints.
Tests authentication, niches, design generation, products, settings, and stats.
"""

import requests
import sys
import json
from datetime import datetime
from typing import Dict, Any, Optional

class ThreadlyCoAPITester:
    def __init__(self, base_url: str = "https://niche-design-hub.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.session = requests.Session()
        self.session.timeout = 30

    def log(self, message: str, level: str = "INFO"):
        """Log test messages with timestamp"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {level}: {message}")

    def run_test(self, name: str, method: str, endpoint: str, expected_status: int, 
                 data: Optional[Dict] = None, headers: Optional[Dict] = None) -> tuple[bool, Dict]:
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        test_headers = {'Content-Type': 'application/json'}
        
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        if headers:
            test_headers.update(headers)

        self.tests_run += 1
        self.log(f"Testing {name}...")
        
        try:
            if method == 'GET':
                response = self.session.get(url, headers=test_headers)
            elif method == 'POST':
                response = self.session.post(url, json=data, headers=test_headers)
            elif method == 'PUT':
                response = self.session.put(url, json=data, headers=test_headers)
            elif method == 'DELETE':
                response = self.session.delete(url, headers=test_headers)
            else:
                raise ValueError(f"Unsupported method: {method}")

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                self.log(f"✅ {name} - Status: {response.status_code}", "PASS")
            else:
                self.log(f"❌ {name} - Expected {expected_status}, got {response.status_code}", "FAIL")
                if response.text:
                    self.log(f"   Response: {response.text[:200]}", "FAIL")

            try:
                response_data = response.json() if response.text else {}
            except json.JSONDecodeError:
                response_data = {"raw_response": response.text}

            return success, response_data

        except Exception as e:
            self.log(f"❌ {name} - Error: {str(e)}", "ERROR")
            return False, {"error": str(e)}

    def test_health_check(self) -> bool:
        """Test health endpoint"""
        success, response = self.run_test("Health Check", "GET", "/health", 200)
        if success and response.get("status") == "healthy":
            self.log("✅ Health check passed - API is running")
            return True
        return False

    def test_login(self, email: str, password: str) -> bool:
        """Test login and store token"""
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "/auth/login",
            200,
            data={"email": email, "password": password}
        )
        
        if success and 'token' in response:
            self.token = response['token']
            self.log(f"✅ Login successful - Token acquired")
            return True
        else:
            self.log(f"❌ Login failed - No token received")
            return False

    def test_auth_me(self) -> bool:
        """Test getting current user info"""
        success, response = self.run_test("Get Current User", "GET", "/auth/me", 200)
        if success and response.get("email"):
            self.log(f"✅ User info retrieved: {response.get('email')}")
            return True
        return False

    def test_get_niches(self) -> tuple[bool, list]:
        """Test fetching niches"""
        success, response = self.run_test("Get Niches", "GET", "/niches", 200)
        if success and isinstance(response, list):
            self.log(f"✅ Retrieved {len(response)} niches")
            return True, response
        return False, []

    def test_get_stats(self) -> tuple[bool, dict]:
        """Test fetching dashboard stats"""
        success, response = self.run_test("Get Stats", "GET", "/stats", 200)
        if success and all(key in response for key in ['total_generated', 'total_approved', 'total_pushed', 'total_live']):
            self.log(f"✅ Stats retrieved: Generated={response.get('total_generated', 0)}, Approved={response.get('total_approved', 0)}")
            return True, response
        return False, {}

    def test_generate_designs(self, niche: str = "Dark Humor", product_type: str = "T-Shirt") -> tuple[bool, list]:
        """Test AI design generation"""
        success, response = self.run_test(
            "Generate Designs",
            "POST",
            "/designs/generate",
            200,
            data={"niche": niche, "product_type": product_type}
        )
        
        if success and 'designs' in response:
            designs = response['designs']
            self.log(f"✅ Generated {len(designs)} designs for {niche} {product_type}")
            return True, designs
        else:
            self.log(f"❌ Design generation failed")
            return False, []

    def test_approve_product(self, design: dict) -> tuple[bool, str]:
        """Test product approval"""
        product_data = {
            "design": design,
            "product_title": f"Test Product - {design.get('title', 'Unknown')}",
            "product_description": "Test product description for automated testing",
            "tags": ["test", "automation", "threadlyco"],
            "product_type": design.get('product_type', 'T-Shirt'),
            "selling_price": 24.99,
            "compare_at_price": 29.99,
            "variants": ["Black", "White"]
        }
        
        success, response = self.run_test(
            "Approve Product",
            "POST",
            "/products/approve",
            200,
            data=product_data
        )
        
        if success and response.get('id'):
            product_id = response['id']
            self.log(f"✅ Product approved with ID: {product_id}")
            return True, product_id
        return False, ""

    def test_get_products(self) -> tuple[bool, list]:
        """Test fetching products"""
        success, response = self.run_test("Get Products", "GET", "/products", 200)
        if success and isinstance(response, list):
            self.log(f"✅ Retrieved {len(response)} products")
            return True, response
        return False, []

    def test_get_settings(self) -> tuple[bool, dict]:
        """Test fetching settings"""
        success, response = self.run_test("Get Settings", "GET", "/settings", 200)
        if success and 'prices' in response:
            self.log(f"✅ Settings retrieved with {len(response.get('prices', {}))} product prices")
            return True, response
        return False, {}

    def test_update_settings(self) -> bool:
        """Test updating settings"""
        settings_data = {
            "promo_code": "TEST20",
            "promo_percentage": 20,
            "compare_at_markup": 25,
            "prices": {
                "T-Shirt": 25.99,
                "Hoodie": 55.99
            }
        }
        
        success, response = self.run_test(
            "Update Settings",
            "PUT",
            "/settings",
            200,
            data=settings_data
        )
        
        if success:
            self.log(f"✅ Settings updated successfully")
            return True
        return False

    def test_push_to_printify(self, product_id: str) -> bool:
        """Test pushing product to Printify (expected to fail without API key)"""
        success, response = self.run_test(
            "Push to Printify",
            "POST",
            f"/products/{product_id}/push-to-printify",
            400  # Expected to fail without Printify API key
        )
        
        if not success and response.get('detail') and 'Printify API key' in response.get('detail', ''):
            self.log(f"✅ Printify push correctly failed - API key required (expected)")
            return True
        elif success:
            self.log(f"✅ Printify push succeeded (API key configured)")
            return True
        else:
            self.log(f"❌ Unexpected Printify push response")
            return False

    def test_logout(self) -> bool:
        """Test logout"""
        success, response = self.run_test("Logout", "POST", "/auth/logout", 200)
        if success:
            self.log(f"✅ Logout successful")
            self.token = None
            return True
        return False

    def run_comprehensive_test(self) -> dict:
        """Run all tests in sequence"""
        self.log("🚀 Starting ThreadlyCo Design Studio API Tests", "START")
        
        results = {
            "health": False,
            "login": False,
            "auth_me": False,
            "niches": False,
            "stats": False,
            "design_generation": False,
            "product_approval": False,
            "products": False,
            "settings": False,
            "settings_update": False,
            "printify_push": False,
            "logout": False
        }

        # 1. Health Check
        results["health"] = self.test_health_check()
        if not results["health"]:
            self.log("❌ Health check failed - API may be down", "CRITICAL")
            return results

        # 2. Authentication
        results["login"] = self.test_login("admin@threadlyco.com", "ThreadlyAdmin2024!")
        if not results["login"]:
            self.log("❌ Login failed - Cannot proceed with authenticated tests", "CRITICAL")
            return results

        results["auth_me"] = self.test_auth_me()

        # 3. Core functionality
        results["niches"], niches_data = self.test_get_niches()
        results["stats"], stats_data = self.test_get_stats()

        # 4. Design generation and approval workflow
        if results["niches"] and niches_data:
            # Use first niche for testing
            test_niche = niches_data[0]['name'] if niches_data else "Dark Humor"
            results["design_generation"], designs = self.test_generate_designs(test_niche)
            
            if results["design_generation"] and designs:
                # Test product approval with first design
                results["product_approval"], product_id = self.test_approve_product(designs[0])
                
                if results["product_approval"] and product_id:
                    # Test Printify push (expected to fail without API key)
                    results["printify_push"] = self.test_push_to_printify(product_id)

        # 5. Products and settings
        results["products"], products_data = self.test_get_products()
        results["settings"], settings_data = self.test_get_settings()
        results["settings_update"] = self.test_update_settings()

        # 6. Logout
        results["logout"] = self.test_logout()

        return results

    def print_summary(self, results: dict):
        """Print test summary"""
        self.log("=" * 60, "SUMMARY")
        self.log(f"📊 Tests Run: {self.tests_run}", "SUMMARY")
        self.log(f"✅ Tests Passed: {self.tests_passed}", "SUMMARY")
        self.log(f"❌ Tests Failed: {self.tests_run - self.tests_passed}", "SUMMARY")
        self.log(f"📈 Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%", "SUMMARY")
        
        self.log("\n🔍 Feature Test Results:", "SUMMARY")
        for feature, passed in results.items():
            status = "✅ PASS" if passed else "❌ FAIL"
            self.log(f"  {feature.replace('_', ' ').title()}: {status}", "SUMMARY")
        
        critical_features = ["health", "login", "niches", "design_generation"]
        critical_passed = all(results.get(f, False) for f in critical_features)
        
        if critical_passed:
            self.log("\n🎉 All critical features are working!", "SUCCESS")
        else:
            self.log("\n⚠️  Some critical features failed!", "WARNING")
        
        return self.tests_passed == self.tests_run

def main():
    """Main test execution"""
    tester = ThreadlyCoAPITester()
    
    try:
        results = tester.run_comprehensive_test()
        all_passed = tester.print_summary(results)
        
        # Return appropriate exit code
        return 0 if all_passed else 1
        
    except KeyboardInterrupt:
        tester.log("\n⏹️  Tests interrupted by user", "INFO")
        return 1
    except Exception as e:
        tester.log(f"\n💥 Unexpected error: {str(e)}", "ERROR")
        return 1

if __name__ == "__main__":
    sys.exit(main())