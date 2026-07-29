# Merchant Dashboard - Google Stitch Prompt

## Project Goal
Create the Merchant Dashboard interface for individual tenant users. This section provides tenant-specific management capabilities with focus on their own business operations, products, customers, and analytics.

## Design Style
- **Tenant-Centric Interface** - Personalized dashboard for individual business owners
- **Operational Focus** - Tools for managing daily business operations
- **Revenue-First Design** - Clear emphasis on sales and revenue generation
- **Arabic RTL Support** - Tenant-specific Arabic interface with Saudi/Egyptian market features
- **Role-Based Access** - Interface customized based on user role within tenant
- **Responsive Design** - Comprehensive desktop interface with mobile supplemental access
- **Performance-Oriented** - Fast access to critical business metrics

## Layout Structure

### Header & Tenant Context
- **Tenant Banner**:
  - Tenant logo and business name
  - Subscription plan indicator (Starter/Professional/Enterprise)
  - Current date and time
  - Quick access to plan upgrade links

- **Breadcrumb Navigation**:
  - Home > Tenant Dashboard
  - Clear indication of business context
  - Quick tenant switching (if multiple tenant access)

### Left Navigation Menu
- **Business Operations Menu**:
  - **Dashboard**: Overview, analytics, key metrics
  - **Products**: Product catalog management
  - **Orders**: Order processing and fulfillment
  - **Inventory**: Stock management and tracking
  - **Customers**: Customer database and management
  - **Reports**: Business analytics and reports
  - **Store Links**: Marketing links and campaigns
  - **Team Members**: Access control and permissions
  - **Settings**: Business configuration

### Main Content Area

#### Dashboard Overview Section
- **Key Performance Indicators (KPIs)**:
  - Today's Sales: Real-time revenue tracking
  - Active Orders: Pending/processed orders count
  - Product Count: Total products in catalog
  - Customer Count: Registered customers
  - Conversion Rate: Sales effectiveness metrics
  - Revenue Growth: Period-over-period comparison

- **Analytics Widgets** (2x2 grid):
  - **Revenue Chart**: Sales over time (line graph)
  - **Top Products** Bar chart of best-selling items
  - **Customer Acquisition** Growth metrics
  - **Order Status** Pie chart of order distribution

#### Quick Access Actions
- **Primary Actions** (3 cards on top):
  - **Add Product** -> Direct link to product creation
  - **View New Orders** -> Filtered order list
  - **Generate Store Link** -> Store link creation interface

- **Secondary Actions** (dashboard footer):
  - Create promotion campaign
  - Update business hours
  - View customer feedback

#### Product Management Section
- **Product Catalog Table**:
  - Search and filter by name, category, price
  - Columns: Product Name, SKU, Price, Stock, Status, Actions
  - Bulk operations: Enable/Disable, Price updates, Stock adjustments
  - Quick actions: View details, Edit, Duplicate, Delete

- **Product Statistics**:
  - Low stock alert indicators
  - Product performance metrics
  - Category breakdown visualization

#### Recent Orders Section
- **Order Timeline**:
  - Filtered by status (new, processing, shipped, completed, cancelled)
  - Order ID, customer, amount, status, action buttons
  - Payment status indicators
  - Tracking number input links

### Right Sidebar/Panels

#### Business Alerts
- **Inventory Alerts**:
  - Products running low on stock
  - Expiring products (if applicable)
  - Out of stock items

- **Customer Alerts**:
  - New customer registrations
  - High-value customer alerts
  - Customer support tickets

#### Quick Reports
- **Sales Summary**:
  - Daily sales total
  - Average order value
  - Conversion rate

- **Product Performance**:
  - Top 5 best-selling products
  - Category-wise performance
  - Seasonal trends

#### System Status
- **Account Status**:
  - Current subscription plan
  - Usage limits (users, products, storage)
  - Payment due dates
  - Next billing cycle

### Footer
- **Tenant Footer**:
  - Business information
  - Current plan details
  - Support contact information
  - Quick navigation links

## Technical Requirements

### Functionality
1. **Tenant Dashboard Components**:
   - Business metrics and KPIs tracking
   - Product management interface
   - Order processing and fulfillment
   - Customer relationship management
   - Analytics and reporting
   - Marketing link management

2. **Advanced Features**:
   - Product bulk upload and import
   - Inventory automation (reorder alerts)
   - Customer segmentation
   - Price rule management
   - Promotion campaign creation
   - Mobile app integration options

3. **Business Intelligence**:
   - Real-time sales analytics
   - Customer behavior tracking
   - Performance benchmarking
   - Trend analysis and forecasting

### Accessibility
1. **ARIA Attributes**:
   - Role-based interface elements
   - Business context indicators
   - Status announcement for screen readers
   - Keyboard navigation support

2. **Visual Design**:
   - Business-focused color coding
   - Clear information hierarchy
   - Responsive design for mobile commerce
   - Data visualization best practices

3. **Performance**:
   - Fast loading of business metrics
   - Efficient filtering and search
   - Real-time updates for critical data
   - Optimized for business workflows

### Integration
1. **Backend Integration**:
   - Tenant-specific data access
   - Product catalog APIs
   - Order processing endpoints
   - Customer management APIs

2. **Analytics Integration**:
   - Business intelligence dashboards
   - Performance tracking
   - Customer behavior analytics
   - ROI calculation

3. **Localization**:
   - Arabic business interface
   - Local currency display (SAR/EGP)
   - Regional date and time formats
   - Cultural compliance

## Future-Ready Considerations
1. **Scalability**:
   - Architecture supports business growth
   - Modular feature additions
   - Performance optimization for scale

2. **Extensibility**:
   - Plugin system for business apps
   - Custom report builder
   - Integration framework

3. **Technology Stack Readiness**:
   - Ready for ERP integration
   - Compatible with POS systems
   - Prepared for omnichannel features

## Development Notes
1. **Primary Colors**: Tenant business colors
2. **Business Typography**: Professional headers and body text
3. **Business Iconography**: Business-specific icons
4. **Business Animation**: Workflow animations
5. **Business-Responsive Design**: Mobile-first with business focus

## Documentation Requirements
1. Component documentation for merchant sections
2. Business process documentation
3. Integration guides for business systems
4. Setup and configuration guides
5. Reporting and analytics documentation

---
*Document created: Google Stitch Prompt for Merchant Dashboard*
*Version: 1.0*
*Status: READY FOR DEVELOPMENT*
