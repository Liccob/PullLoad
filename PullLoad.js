import React from 'react';
import PropTypes from 'prop-types';
import {
  View,
  Text,
  PanResponder,
  Animated,
  Easing,
  Dimensions,
  ScrollView,
  Platform,
  Image
} from 'react-native';

const { width, height } = Dimensions.get('window');
export default class PullLoadView extends React.Component {
	static propTypes = {
        onEndReached: PropTypes.func,
        device_styles: PropTypes.object, //设备相关信息
    };
    static defaultProps = {
		device_styles: {nav_height:0},
        onEndReached: ()=> {}
    };
  constructor(props) {
    super(props);

    this.y = new Animated.Value(0);
    this.x = new Animated.Value(-width / 2 - 60);
    this.show = new Animated.Value(0);
    this.refreshing = false;
    this.pullToOk = false; // 达到刷新阈值
    this.scrollTop = 0;
    this.thisTouchUsePan = false;
    this.scrolly = 0;
    const list = this.translate(0, props.init_sections);
    this.state = {
      refreshing: false,
      list: list
    };
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.refreshing !== this.props.refreshing) {
      if (!nextProps.refreshing) {
        this.resetRefresh();
      }
    }
  }

  // todo 加入滚动方向的因素，来决定上方显示的多，还是下方显示的多
  handleScroll = e => {
    const { nativeEvent } = e;
    const { contentOffset } = nativeEvent;
    const { layoutMeasurement } = nativeEvent;
    const { contentSize } = nativeEvent;

    const { y } = contentOffset;
    const viewAreaHeight = layoutMeasurement.height;
    const contentHeight = contentSize.height;
    if (y == 0) {
      this.scrollRef.getScrollResponder().setNativeProps({ scrollEnabled: false });
    }
    this.scrolly = y;
    this.scrollTop = y;
    this.props.onScroll && this.props.onScroll(y);

    // 注意调用顺序：先checkItemHide，再checkItemShow
    // this.checkItemHide(y); // 无论哪种情况，都需要检测是否存在需要释放的元素

    // this.check(y);

    const end_to_content_bottom = contentHeight - y - viewAreaHeight;
    if (end_to_content_bottom < 400) {
      this.props.onEndReached && this.props.onEndReached(end_to_content_bottom);
    }
  };

  scrollTo = options => {
    this.s && this.s.scrollTo && this.s.scrollTo(options);
  };

  refreshCb = () => {
    const { refreshCallback } = this.props;
    // 外层传进来的得callback
    refreshCallback && refreshCallback();
  };

  //加载完之后的回调
  resetRefresh = () => {
    // 整体上移 以及狗右移
    // 延时是因为需要避免卡顿
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(this.y, {
          toValue: 0,
          duration: 330,
          easing: Easing.ease,
          // useNativeDriver:true
        }),
        Animated.timing(this.x, {
          toValue: (width * 2) / 3,
          duration: 330,
          easing: Easing.ease,
          useNativeDriver:true
        })
      ]).start();
    }, 300);
  };

  // 小狗进入的动画
  showInAni = () => {
    this.isAni = true;
    Animated.timing(this.x, {
      toValue: -(width * 1) / 3 + 10,
      duration: 100,
      easing: Easing.ease,
      useNativeDriver:true
    }).start();
    setTimeout(() => {
      this.isAni = false;
    }, 110);
  };

	render() {
	const { device_styles } = this.props; //完成需要将顶部的状态栏和导航栏高度传进来
    const { list } = this.state;
    const responder = PanResponder.create({
      onMoveShouldSetPanResponder: (event, gesture) => {
        const { dy } = gesture; // dx dy 从触碰屏幕坐标开始算
        // 如果没有滚动距离得时候 统一用手势 这时即使是向上滑动也走手势 不走滚动条
        // 如果有滚动距离那么就一定走scrollView的scroll 这时出现的问题就是即使滚动触顶了 也需要再拉一次进行下拉刷新
        if (Math.abs(dy) < 3) {
          return false;
        }
        if (this.scrollTop <= 0 && Math.abs(dy) > 3) {
          return true;
        }
      },
      onPanResponderMove: (event, gesture) => {
        const { dy } = gesture;
        // 如果在滚动触顶之后得滑动小于0那么就定位其位置距顶0
        if (dy < 0) {
          //如果是在触顶时向下滑动那么这时就需要用手势做scrollView得滚动
          if (this.scrollRef) {
            this.scrollRef.scrollTo({ y: -dy, animated: false });
          }
          // 外层scrollView的位置归零（不是scroll的距离）
          this.y.setValue(0);
          // 没到阈值
          this.pullToOk = false;
          // 狗消失
          this.show.setValue(0);
          this.x.setValue(-width / 2 - 60);
        } else {
          // 如果触发了手势并且dy>0那么这时候滚动条一定是0
          if (this.scrollRef) {
            this.scrollRef.scrollTo({ y: 0, animated: false });
          }
        }
        if (dy <= 50 && dy > 0) {
          this.y.setValue(dy/2);
          // 没到阈值
          this.pullToOk = false;
          // 狗消失
          this.show.setValue(0);
          this.x.setValue(-width / 2 - 60);
        } else if (dy > 50) {
          this.y.setValue(dy/2);
          // 达到阈值
          this.pullToOk = true;
          // 狗显示
          this.show.setValue(1);
          // 执行出现动画
          !this.isAni && this.showInAni();
        }
        // 根据下滑得距离来计算横滑条应该出现的X距离
        if (dy > 0) {
          this.show.setValue(1);
        } else {
          this.show.setValue(0);
        }
      },
      onPanResponderRelease: () => {
        if (this.scrollTop > 0) {
          this.scrollRef.getScrollResponder().setNativeProps({ scrollEnabled: true });
        }
        if (this.pullToOk) {
          this.show.setValue(1);
          this.y.setValue(50);
          // 如果达到了阈值那么就触发刷新的callback
          this.refreshCb();
          this.scrollRef.getScrollResponder().setNativeProps({ scrollEnabled: false });
        } else {
          this.y.setValue(0);
        }
      }
    });
    return (
      <Animated.View
        {...responder.panHandlers}
        style={[
          {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: '#f4f4f4',
            width: width,
            height: height + 50 - device_styles.nav_height,
            top: this.y,
            justifyContent: 'center'
          }
        ]}
      >
        <Image
          source={require('../../Assets/images/icon/downpullbg.png')}
          style={{
            position: 'absolute',
            top: -40,
            height: 40,
            width: (40 * 279) / 95,
            left: (width - (40 * 279) / 95) / 2
          }}
        />
        <Animated.View
          style={{
            transform: [
              {
                translateX: this.x
              },
              { translateY: -50 }
            ],
            height: 50,
            opacity: this.show,
            overflow: 'hidden',
            width:width
          }}
        >
          <View
            style={{
              height: 50,
              justifyContent: 'center',
              alignItems: 'center',
              textAlign: 'center',
              fontSize: 16,
              flexDirection: 'row'
            }}
          >
            <Image
              source={require('../../Assets/images/icon/downpull.gif')}
              style={{ height: 50, width: 89 }}
            />
          </View>
        </Animated.View>
        <ScrollView
          scrollEventThrottle={10}
          onScroll={this.handleScroll}
          style={[
            {
              position: 'relative',
              top: -50,
              height: height - device_styles.nav_height
            },
            this.props.style
          ]}
          ref={scrollRef => {
            this.scrollRef = scrollRef;
          }}
          showsVerticalScrollIndicator={this.props.showsVerticalScrollIndicator}
          onScrollBeginDrag={this.props.onScrollBeginDrag}
          automaticallyAdjustContentInsets={false}
          stickyHeaderIndices={this.props.stickyHeaderIndices}
          onContentSizeChange={this.props.onContentSizeChange}
          contentContainerStyle={this.props.contentContainerStyle}
          scrollEnabled={Platform.OS == 'web'}
        >
          {list}
        </ScrollView>
      </Animated.View>
    );
  }
}