# NFT Generator

A comprehensive web-based NFT collection generator with both local procedural generation and AI-powered trait creation capabilities.

## Getting Started (Simple Mode)

For basic NFT generation without AI features:

1. Open `index.html` in your browser
2. Select "Procedural" as your active provider (no API key required)
3. Adjust trait complexity sliders and rarity weights as desired
4. Click "Generate Collection" to create your NFTs
5. Download the ZIP file containing images and metadata

## Current Architecture

### 🎨 Generation Modes
- **Procedural (Free)**: Local canvas-based generation with unlimited usage
- **AI-Powered**: OpenAI and Stable Diffusion integration (requires API keys)
- **Hybrid**: AI base images with procedural overlays (experimental)

### 🔧 Advanced Features (Optional)
- **Cost & Budget Management**: Track API costs and set spending limits
- **Quality Assurance**: Automated outlier detection and regeneration
- **Analytics Dashboard**: Usage statistics and cost breakdowns
- **Image Caching**: IndexedDB-based caching for performance
- **Batch Optimization**: Intelligent request batching and deduplication

### ⚖️ Rarity System
- **Weighted Random Selection**: Configure individual trait rarity percentages
- **Rarity Tiers**: Automatic classification (Common, Rare, Epic, Legendary)
- **Validation System**: Ensures rarity weights sum to 100% per category
- **Visual Controls**: Interactive sliders with real-time feedback

### 📦 Export & Download
- **ZIP Package**: Complete collection with images and metadata
- **JSON Metadata**: Standard NFT metadata format with attributes
- **Rarity Scores**: Calculated rarity scores for each generated NFT
- **Collection Manifest**: Summary statistics and generation info

## Requirements

### Basic Mode (Procedural Only)
- Modern web browser with Canvas support
- No additional setup required

### AI Features
- Valid API keys for OpenAI and/or Stable Diffusion
- HTTPS connection (recommended for security)
- IndexedDB support for caching
- WebCrypto API for secure key storage

## Security Notice

**⚠️ Important**: This is a client-side application. API keys are stored locally in your browser using encrypted storage when possible. 

**Recommended Usage:**
- Use on your own computer or trusted device
- Avoid shared or public computers
- Use HTTPS when entering API keys
- Consider using a dedicated API key with spending limits

**Not Suitable For:**
- Production environments requiring server-side key management
- Shared hosting or public kiosks
- High-security enterprise environments

## Getting Started

### Prerequisites
- Modern web browser with Canvas API support
- No server required - runs entirely client-side

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/billibobby/NFT-Generator.git
   cd NFT-Generator
   ```

2. Open `index.html` in your web browser

### Usage

#### Step 1: Generate Trait Layers
1. Adjust the number of traits for each category (13-50 per category)
2. Set complexity levels (1-10) to control visual detail
3. Enter color seeds (hex codes like `#FF5733` or `random`)
4. Click "Generate Traits" to create procedural trait layers

#### Step 2: Configure Rarity
1. Use the sliders to adjust rarity weights for each trait
2. Ensure each category's weights sum to 100%
3. Monitor rarity tiers (Common/Rare/Epic/Legendary)
4. Use "Reset All to Equal Weights" if needed

#### Step 3: Generate Collection
1. Set your desired collection size (1-10,000)
2. Enter a collection name
3. Click "Generate Collection"
4. Watch the progress and preview updates

#### Step 4: Download
1. Click "Download Collection" to get a ZIP file containing:
   - `/images/` folder with all NFT images (PNG format)
   - `/metadata/` folder with JSON metadata files
   - `collection.json` with generation statistics

## Technical Architecture

### Core Components
- **Trait Generation Engine**: Procedural canvas-based trait creation
- **Rarity Management System**: Weighted random selection with validation
- **Canvas Compositing**: Layer-based NFT assembly
- **Batch Processing**: Efficient collection generation with progress tracking

### File Structure
```
NFT-Generator/
├── index.html          # Main application interface
├── app.js             # Core JavaScript functionality
├── styles.css         # Responsive CSS styling
└── README.md          # Project documentation
```

### Key Technologies
- **HTML5 Canvas**: For procedural trait generation and compositing
- **Vanilla JavaScript**: No framework dependencies
- **CSS Grid/Flexbox**: Responsive layout system
- **JSZip**: Client-side ZIP file generation
- **Web APIs**: FileReader, Blob, Canvas 2D Context

## Browser Compatibility
- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## Performance Notes
- Optimized for collections up to 10,000 NFTs
- Uses Web Workers concepts for non-blocking generation
- Memory-efficient canvas operations
- Progressive loading for large collections

## Contributing
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License
This project is open source and available under the [MIT License](LICENSE).

## Roadmap
- [ ] Custom trait upload support
- [ ] Advanced rarity distribution algorithms
- [ ] Batch metadata editing
- [ ] Collection analytics dashboard
- [ ] Export to popular NFT marketplaces

---

**Built with ❤️ for the NFT community**

## Provider Status

| Provider | Status | Notes |
|----------|--------|-------|
| Procedural | ✅ Fully Supported | Free, unlimited local generation |
| OpenAI | ✅ Supported | Requires API key, costs apply |
| Stable Diffusion | ✅ Supported | Requires API key, costs apply |
| Gemini | 🚧 Coming Soon | Placeholder implementation only |

## Roadmap / Known Limitations

### In Development
- [ ] Gemini image generation API integration
- [ ] Batch optimizer result mapping improvements
- [ ] Advanced failover configuration UI
- [ ] Server-side API key management option

### Current Limitations
- Gemini provider is stubbed (not functional)
- Some advanced features are experimental
- Client-side storage only (no server backend)
- Limited to browser-supported image formats

### Architecture Notes
- Built as a single-page application (SPA)
- All processing happens in the browser
- No server-side dependencies
- Modular design with optional advanced features

## Development

The codebase is organized into focused modules:
- `app.js` - Core generation logic and UI coordination
- `api-providers.js` - Provider implementations and base classes
- `api-manager.js` - Provider management and failover
- `budget-manager.js` - Cost tracking and spending limits
- `cost-analytics.js` - Usage analytics and reporting
- `cache-manager.js` - Image caching and optimization
- `quality-assurance.js` - Automated quality checks
- Additional utility modules for specific features

## License

MIT License - see LICENSE file for details.