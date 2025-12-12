# NFT Generator

A sophisticated web-based NFT collection generator that creates procedural trait layers with configurable rarity weights and batch collection generation.

## Features

### 🎨 Procedural Trait Generation
- **5 Trait Categories**: Background, Body, Eyes, Mouth, Hat
- **Complexity Control**: Adjustable complexity levels (1-10) for each trait type
- **Color Seeding**: Custom color palettes or random generation
- **Canvas-based Rendering**: High-quality 500x500px trait generation

### ⚖️ Advanced Rarity System
- **Weighted Random Selection**: Configure individual trait rarity percentages
- **Rarity Tiers**: Automatic classification (Common, Rare, Epic, Legendary)
- **Validation System**: Ensures rarity weights sum to 100% per category
- **Visual Controls**: Interactive sliders with real-time feedback

### 🚀 Batch Collection Generation
- **Scalable Generation**: Create collections up to 10,000 NFTs
- **Duplicate Prevention**: Smart algorithm to avoid identical combinations
- **Layer Compositing**: Proper z-index layering for trait combination
- **Progress Tracking**: Real-time generation progress with preview updates

### 📦 Export & Download
- **ZIP Package**: Complete collection with images and metadata
- **JSON Metadata**: Standard NFT metadata format with attributes
- **Rarity Scores**: Calculated rarity scores for each generated NFT
- **Collection Manifest**: Summary statistics and generation info

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