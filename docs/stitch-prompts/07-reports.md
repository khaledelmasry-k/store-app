# Reports & Analytics - Google Stitch Prompt

## Project Goal
Create the Reports & Analytics interface for business intelligence and analytics. This provides comprehensive reporting on sales, product performance, customer behavior, and trend analysis within the tenant workspace.

## Design Style
- **Data-Intensive Interface** - Focus on business intelligence and metrics
- **Analytics-Centric Design** - Professional reporting and visualization tools
- **Multi-Tenant Support** - Tenant-specific analytics and reporting
- **Arabic RTL Support** - Full RTL interface with Saudi/Egyptian market features
- **Role-Based Access** - Interface customized based on user role within tenant
- **Responsive Design** - Comprehensive desktop interface with mobile supplemental access
- **Performance-Oriented** - Fast access to analytics data and reports

## Layout Structure

### Header & Context
- **Reports & Analytics Title**:
  - "التقارير والتحليلات" (Reports & Analytics)
  - Current period and date range
  - Quick access to export and scheduling functions
  - Date range selector

- **Action Bar**:
  - "تصدير التقرير" (Export Report) - Export current view
  - "جدولة تقرير" (Schedule Report) - Schedule automated reports
  - "إعداد تقرير مخصص" (Create Custom Report) - Custom report builder

### Main Content Area

#### Dashboard Overview
- **Key Metrics Cards** (4 cards in grid):
  - Total Revenue: Platform-wide revenue metrics
  - Total Orders: Order count and growth
  - Total Customers: Customer count and growth
  - Conversion Rate: Sales effectiveness metrics

- **Date Range Selector**:
  - Today, Yesterday, Last 7 days, Last 30 days, This month, Last month, Custom range

- **Analytics Widgets** (2x2 grid):
  - **Revenue Chart**: Sales over time (line graph)
  - **Order Status**: Order distribution (pie chart)
  - **Top Products**: Best-selling items (bar chart)
  - **Customer Acquisition**: New customer growth (line graph)

#### Sales Analytics
- **Revenue Trends**:
  - Daily/weekly/monthly revenue
  - Revenue by product category
  - Revenue by store
  - Revenue by customer segment

- **Order Analysis**:
  - Orders by status
  - Orders by time of day
  - Orders by day of week
  - Average order value trends

- **Product Performance**:
  - Top selling products
  - Product category performance
  - Low performing products
  - Product inventory turnover

#### Customer Analytics
- **Customer Behavior**:
  - New vs returning customers
  - Customer lifetime value
  - Customer acquisition cost
  - Customer retention rate

- **Customer Segmentation**:
  - Customers by tag
  - Customers by segment
  - High-value customer analysis
  - Customer churn analysis

#### Inventory Analytics
- **Stock Levels**:
  - Current stock levels
  - Low stock alerts
  - Out of stock items
  - Stock turnover rates

- **Product Performance**:
  - Best performing products
  - Worst performing products
  - Seasonal trends
  - Product lifecycle analysis

#### Custom Report Builder
- **Report Type Selection**:
  - Sales report
  - Product report
  - Customer report
  - Inventory report
  - Custom report

- **Report Configuration**:
  - Date range
  - Filters
  - Group by options
  - Sort options
  - Columns to include

- **Report Preview**:
  - Preview of report data
  - Chart visualization options
  - Export options

#### Scheduled Reports
- **Report Schedule List**:
  - Report name, type, frequency, next run, status
  - Enable/disable schedules
  - Edit/delete schedules

- **Schedule Configuration**:
  - Report name
  - Report type
  - Frequency (daily, weekly, monthly)
  - Time
  - Recipients
  - Export format

### Right Sidebar/Panels

#### Quick Filters
- **Preset Filters**:
  - Today
  - Last 7 days
  - Last 30 days
  - This month
  - Last month
  - Custom range

- **Quick Reports**:
  - Sales summary
  - Top products
  - New customers
  - Revenue by category

#### Export Options
- **Export Formats**:
  - CSV
  - Excel
  - PDF
  - PNG (for charts)

- **Export Scope**:
  - Current view
  - All data
  - Filtered data

#### Report History
- **Recent Reports**:
  - Report name, type, date generated
  - Export links
  - Status

### Footer
- **Reports & Analytics Footer**:
  - Current date range
  - Data source information
  - Last updated timestamp
  - Quick navigation links

## Technical Requirements

### Functionality
1. **Analytics Components**:
   - Dashboard with key metrics cards
   - Chart visualization (line, bar, pie charts)
   - Report table with sorting and filtering
   - Date range selector
   - Export functionality

2. **Advanced Features**:
   - Custom report builder
   - Scheduled reports
   - Report templates
   - Chart customization
   - Data drill-down

3. **Data Visualization**:
   - Line charts for trends
   - Bar charts for comparisons
   - Pie charts for distributions
   - Tables for detailed data
   - Interactive charts with tooltips

4. **Performance**:
   - Optimized data loading
   - Caching for frequently accessed reports
   - Efficient data aggregation
   - Fast chart rendering

### Accessibility
1. **ARIA Attributes**:
   - Proper landmarks for report sections
   - Keyboard navigation for charts and tables
   - Focus management for modals and dialogs
   - Screen reader support for data visualization

2. **Visual Design**:
   - Clear information hierarchy for reports
   - Color coding for data visualization
   - Responsive design for all devices
   - Consistent spacing and layout

3. **Performance**:
   - Fast loading of report data
   - Efficient data aggregation
   - Optimized chart rendering
   - Minimal page load times

### Integration
1. **Backend Integration**:
   - Analytics API endpoints
   - Report generation APIs
   - Scheduled report APIs
   - Export endpoints

2. **Analytics Integration**:
   - Business intelligence dashboards
   - Performance tracking
   - Trend analysis
   - Forecasting

3. **Localization**:
   - Arabic analytics interface
   - Local currency display (SAR/EGP)
   - Regional date and time formats
   - Cultural compliance

## Future-Ready Considerations
1. **Scalability**:
   - Architecture supports large datasets
   - Database optimization for analytics queries
   - Caching for frequently accessed reports
   - CDN for report assets

2. **Extensibility**:
   - Plugin system for report types
   - Custom visualization components
   - Integration framework for BI tools
   - API-first design for external integrations

3. **Technology Stack Readiness**:
   - Ready for advanced analytics
   - Compatible with BI platforms
   - Prepared for AI-powered insights
   - Ready for real-time analytics

## Development Notes
1. **Primary Colors**: Use existing application colors (#FF9900, #131921, #FEBD69)
2. **Typography**: Plus Jakarta Sans for headings, Noto Sans Arabic for Arabic text
3. **Iconography**: Material Symbols for all UI elements
4. **Animation**: Smooth transitions for chart updates
5. **Responsive Design**: Desktop-first with mobile supplemental access
6. **Backward Compatibility**: Existing dashboard analytics must continue working

## Documentation Requirements
1. Component documentation for analytics sections
2. API endpoint documentation for analytics
3. Report builder documentation
4. Chart visualization guides
5. Scheduled report configuration guides

---

*Document created: Google Stitch Prompt for Reports & Analytics*
*Version: 1.0*
*Status: READY FOR DEVELOPMENT*

**Update the existing project. Do NOT redesign existing screens. Do NOT remove components. Do NOT change navigation. Do NOT change business logic. Only create missing UI. Keep identical design language. Keep RTL. Keep responsiveness.**